/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { BaseApi, RetrieveOptions, RetrievePathOptions, ApiResult, SourcePath } from '../types';
import { MetadataConverter } from '../convert';
import { DeployError } from '../errors';
import { MetadataDeployOptions } from '../types/client';
import { SourceComponent } from '../metadata-registry';
import {
  MetadataSourceDeployResult,
  Id,
  DeployResult,
  ComponentDeployment,
  DeployMessage
} from '../types/newClient';

export const DEFAULT_API_OPTIONS = {
  rollbackOnError: true,
  ignoreWarnings: false,
  checkOnly: false,
  singlePackage: true
};

/* eslint-disable @typescript-eslint/no-unused-vars */
export class MetadataApi extends BaseApi {
  public async retrieveWithPaths(options: RetrievePathOptions): Promise<ApiResult> {
    throw new Error('Method not implemented.');
  }
  public async retrieve(options: RetrieveOptions): Promise<ApiResult> {
    throw new Error('Method not implemented.');
  }

  public async deploy(
    components: SourceComponent | SourceComponent[],
    options?: MetadataDeployOptions
  ): Promise<MetadataSourceDeployResult> {
    const metadataComponents = Array.isArray(components) ? components : [components];

    const converter = new MetadataConverter();
    const { zipBuffer } = await converter.convert(metadataComponents, 'metadata', { type: 'zip' });

    const deployID = await this.metadataDeployID(zipBuffer, options);
    const deployStatusPoll = this.metadataDeployStatusPoll(deployID, options);
    const componentDeploymentMap = new Map<string, ComponentDeployment>();
    for (const component of metadataComponents) {
      componentDeploymentMap.set(`${component.type.name}:${component.fullName}`, {
        status: 'Unchanged',
        component,
        diagnostics: []
      });
    }

    const result = await deployStatusPoll;

    return this.buildSourceDeployResult(componentDeploymentMap, result);
  }

  public async deployWithPaths(
    paths: SourcePath,
    options?: MetadataDeployOptions
  ): Promise<MetadataSourceDeployResult> {
    const components = this.registry.getComponentsFromPath(paths);
    return this.deploy(components, options);
  }

  private async metadataDeployID(zipBuffer: Buffer, options?: MetadataDeployOptions): Promise<Id> {
    if (!options || !options.apiOptions) {
      options = {
        apiOptions: DEFAULT_API_OPTIONS
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
    const wait = (): Promise<void> => {
      return new Promise(resolve => {
        setTimeout(resolve, interval);
      });
    };

    let result;
    const timeout = !options || !options.wait ? 10000 : options.wait;
    const endTime = Date.now() + timeout;
    do {
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
        case 'Succeeded':
        case 'Failed':
        case 'Canceled':
          return result;
      }

      await wait();
    } while (Date.now() < endTime);

    return result;
  }

  private buildSourceDeployResult(
    componentDeploymentMap: Map<string, ComponentDeployment>,
    result: DeployResult
  ): MetadataSourceDeployResult {
    const deployResult: MetadataSourceDeployResult = {
      id: result.id,
      status: result.status,
      success: result.success
    };

    const messages = this.getDeployMessages(result);

    if (messages.length > 0) {
      deployResult.components = [];
      for (const message of messages) {
        const componentKey = `${message.componentType}:${message.fullName}`;
        const componentDeployment = componentDeploymentMap.get(componentKey);

        if (componentDeployment) {
          if (message.created === 'true') {
            componentDeployment.status = 'Created';
          } else if (message.changed === 'true') {
            componentDeployment.status = 'Changed';
          } else if (message.deleted === 'true') {
            componentDeployment.status = 'Deleted';
          } else if (message.success === 'false') {
            componentDeployment.status = 'Failed';
          }

          if (message.problem) {
            componentDeployment.diagnostics.push({
              lineNumber: message.lineNumber,
              columnNumber: message.columnNumber,
              message: message.problem,
              type: message.problemType
            });
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
}
