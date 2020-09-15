/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  BaseApi,
  RetrieveOptions,
  RetrievePathOptions,
  ApiResult,
  SourceDeployResult,
  ComponentDeployment,
  ComponentStatus,
  DeployResult,
  RecordId,
  DeployStatus,
  DeployMessage,
  MetadataDeployOptions,
} from './types';
import { MetadataConverter } from '../convert';
import { DeployError } from '../errors';
import { ManifestGenerator, SourceComponent } from '../metadata-registry';
import { DiagnosticUtil } from './diagnosticUtil';
import { SourcePath } from '../common';
import * as unzipper from 'unzipper';
import { parse } from 'fast-xml-parser';
import { pipeline as cbPipeline } from 'stream';
import { promisify } from 'util';
import { join } from 'path';
const pipeline = promisify(cbPipeline);

export const DEFAULT_API_OPTIONS = {
  rollbackOnError: true,
  ignoreWarnings: false,
  checkOnly: false,
  singlePackage: true,
};

export type RetrieveRequest = {
  apiVersion: string;
  packageNames?: string[];
  singlePackage?: boolean;
  specificFiles?: string[];
  unpackaged: {
    members: string[];
    name: string;
  };
};

export enum RetrieveStatus {
  Pending = 'Pending',
  InProgress = 'InProgress',
  Succeeded = 'Succeeded',
  Failed = 'Failed',
}

export type RetrieveResult = {
  done: boolean;
  errorMessage: string;
  errorStatusCode: string;
  fileProperties: {}[];
  id: string;
  messages: string;
  status: RetrieveStatus;
  success: boolean;
  // this is a base64binary
  zipFile: string;
};

/* eslint-disable @typescript-eslint/no-unused-vars */
export class MetadataApi extends BaseApi {
  public async retrieveWithPaths(options: RetrievePathOptions): Promise<ApiResult> {
    throw new Error('Method not implemented.');
  }

  public async retrieve(options: RetrieveOptions): Promise<ApiResult> {
    const retrieveRequest = this.formatRetrieveRequest(options.components);
    const retrievedComponents = await this.getRetrievedComponents(retrieveRequest);
    const convertedComponents = await this.getConvertedComponents(retrievedComponents, options);
    return { success: true, components: convertedComponents };
  }

  private formatRetrieveRequest(components: SourceComponent[]): RetrieveRequest {
    const manifestGenerator = new ManifestGenerator(this.registry);
    const manifest = manifestGenerator.createManifest(components);
    const manifestJson = parse(manifest);
    const packageData = manifestJson.Package;
    delete packageData.$;
    const retrieveRequest = {
      apiVersion: this.registry.getApiVersion(),
      unpackaged: packageData,
    };
    return retrieveRequest;
  }

  private async getRetrievedComponents(
    retrieveRequest: RetrieveRequest
  ): Promise<SourceComponent[]> {
    // @ts-ignore
    const retrieveStream = this.connection.metadata.retrieve(retrieveRequest).stream();
    const tempCmpDir = join('.sfdx', 'tmp');
    await pipeline(retrieveStream, unzipper.Extract({ path: tempCmpDir }));

    const retrievedComponents = this.registry.getComponentsFromPath(tempCmpDir);
    return retrievedComponents;
  }

  private async getConvertedComponents(
    retrievedComponents: SourceComponent[],
    options: RetrieveOptions
  ): Promise<SourceComponent[]> {
    const converter = new MetadataConverter();
    await converter.convert(retrievedComponents, 'source', {
      type: 'directory',
      outputDirectory: options.output,
    });

    const convertedComponents = this.registry.getComponentsFromPath(options.output);
    return convertedComponents;
  }

  public async deploy(
    components: SourceComponent | SourceComponent[],
    options?: MetadataDeployOptions
  ): Promise<SourceDeployResult> {
    const metadataComponents = Array.isArray(components) ? components : [components];

    const converter = new MetadataConverter();
    const { zipBuffer } = await converter.convert(metadataComponents, 'metadata', { type: 'zip' });

    const deployID = await this.metadataDeployID(zipBuffer, options);
    const deployStatusPoll = this.metadataDeployStatusPoll(deployID, options);
    const componentDeploymentMap = new Map<string, ComponentDeployment>();
    for (const component of metadataComponents) {
      componentDeploymentMap.set(`${component.type.name}:${component.fullName}`, {
        status: ComponentStatus.Unchanged,
        component,
        diagnostics: [],
      });
    }

    const result = await deployStatusPoll;

    return this.buildSourceDeployResult(componentDeploymentMap, result);
  }

  public async deployWithPaths(
    paths: SourcePath,
    options?: MetadataDeployOptions
  ): Promise<SourceDeployResult> {
    const components = this.registry.getComponentsFromPath(paths);
    return this.deploy(components, options);
  }

  private async metadataDeployID(
    zipBuffer: Buffer,
    options?: MetadataDeployOptions
  ): Promise<RecordId> {
    if (!options || !options.apiOptions) {
      options = {
        apiOptions: DEFAULT_API_OPTIONS,
      };
    } else {
      for (const [property, value] of Object.entries(DEFAULT_API_OPTIONS)) {
        if (!(property in options.apiOptions)) {
          //@ts-ignore ignore while dynamically building the defaults
          options.apiOptions[property] = value;
        }
      }
    }
    const result = await this.connection.metadata.deploy(zipBuffer, options.apiOptions);
    return result.id;
  }

  private async metadataDeployStatusPoll(
    deployID: string,
    options: MetadataDeployOptions,
    interval = 100
  ): Promise<DeployResult> {
    let result;

    const wait = (interval: number): Promise<void> => {
      return new Promise((resolve) => {
        setTimeout(resolve, interval);
      });
    };

    const timeout = !options || !options.wait ? 10000 : options.wait;
    const endTime = Date.now() + timeout;
    let triedOnce = false;
    do {
      if (triedOnce) {
        await wait(interval);
      }

      try {
        // Recasting to use the library's DeployResult type
        result = ((await this.connection.metadata.checkDeployStatus(
          deployID,
          true
        )) as unknown) as DeployResult;
      } catch (e) {
        throw new DeployError('md_request_fail', e);
      }

      switch (result.status) {
        case DeployStatus.Succeeded:
        case DeployStatus.Failed:
        case DeployStatus.Canceled:
          return result;
      }

      triedOnce = true;
    } while (Date.now() < endTime);

    return result;
  }

  private buildSourceDeployResult(
    componentDeploymentMap: Map<string, ComponentDeployment>,
    result: DeployResult
  ): SourceDeployResult {
    const deployResult: SourceDeployResult = {
      id: result.id,
      status: result.status,
      success: result.success,
    };

    const messages = this.getDeployMessages(result);
    const diagnosticUtil = new DiagnosticUtil('metadata');

    if (messages.length > 0) {
      deployResult.components = [];
      for (let message of messages) {
        message = this.sanitizeDeployMessage(message);
        const componentKey = `${message.componentType}:${message.fullName}`;
        const componentDeployment = componentDeploymentMap.get(componentKey);

        if (componentDeployment) {
          if (message.created === 'true') {
            componentDeployment.status = ComponentStatus.Created;
          } else if (message.changed === 'true') {
            componentDeployment.status = ComponentStatus.Changed;
          } else if (message.deleted === 'true') {
            componentDeployment.status = ComponentStatus.Deleted;
          } else if (message.success === 'false') {
            componentDeployment.status = ComponentStatus.Failed;
          }

          if (message.problem) {
            diagnosticUtil.setDiagnostic(componentDeployment, message);
          }
        }
      }
      deployResult.components = Array.from(componentDeploymentMap.values());
    }

    return deployResult;
  }

  private getDeployMessages(result: DeployResult): DeployMessage[] {
    const messages: DeployMessage[] = [];
    if (result.details) {
      const { componentSuccesses, componentFailures } = result.details;
      if (componentSuccesses) {
        if (Array.isArray(componentSuccesses)) {
          messages.push(...componentSuccesses);
        } else {
          messages.push(componentSuccesses);
        }
      }
      if (componentFailures) {
        if (Array.isArray(componentFailures)) {
          messages.push(...componentFailures);
        } else {
          messages.push(componentFailures);
        }
      }
    }
    return messages;
  }

  /**
   * Fix any issues with the deploy message returned by the api.
   * TODO: remove as fixes are made in the api.
   */
  private sanitizeDeployMessage(message: DeployMessage): DeployMessage {
    // lwc doesn't properly use the fullname property in the api.
    message.fullName = message.fullName.replace(/markup:\/\/c:/, '');
    return message;
  }
}
