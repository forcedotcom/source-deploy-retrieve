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
  SourceDeployResult,
  ComponentDeployment,
  ComponentStatus,
  DeployResult,
  RecordId,
  DeployStatus,
  DeployMessage,
  MetadataDeployOptions,
  RetrieveRequest,
  RetrieveResult,
  RetrieveStatus,
  SourceRetrieveResult,
  RetrieveFailure,
  RetrieveSuccess,
} from './types';
import { ConvertOutputConfig, MetadataConverter } from '../convert';
import { DeployError, RetrieveError } from '../errors';
import { ManifestGenerator, MetadataResolver, SourceComponent } from '../metadata-registry';
import { DiagnosticUtil } from './diagnosticUtil';
import { SourcePath } from '../common';
import { parse } from 'fast-xml-parser';
import { ZipTreeContainer } from '../metadata-registry/treeContainers';
import { ComponentSet } from '../collections';

export const DEFAULT_API_OPTIONS = {
  rollbackOnError: true,
  ignoreWarnings: false,
  checkOnly: false,
  singlePackage: true,
};

export class MetadataApi extends BaseApi {
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
    const components = this.resolver.getComponentsFromPath(paths);
    return this.deploy(components, options);
  }

  // TODO: W-8023153: move filtering logic to registry
  public async retrieveWithPaths(options: RetrievePathOptions): Promise<SourceRetrieveResult> {
    const allComponents: SourceComponent[] = [];
    for (const filepath of options.paths) {
      allComponents.push(...this.resolver.getComponentsFromPath(filepath));
    }

    const hashedCmps = new Set();
    const uniqueComponents = allComponents.filter((component) => {
      const hashed = this.hashElement(component);
      if (!hashedCmps.has(hashed)) {
        hashedCmps.add(hashed);
        return component;
      }
    });
    const retrieveOptions = { components: uniqueComponents } as RetrieveOptions;
    return this.retrieve(Object.assign(retrieveOptions, options));
  }

  public async retrieve(options: RetrieveOptions): Promise<SourceRetrieveResult> {
    let components: SourceComponent[] = [];
    const retrieveRequest = this.formatRetrieveRequest(options.components);
    const retrieveResult = await this.getRetrievedResult(retrieveRequest, options);
    if (retrieveResult.status === RetrieveStatus.Succeeded) {
      const tree = await ZipTreeContainer.create(Buffer.from(retrieveResult.zipFile, 'base64'));
      const zipComponents = new MetadataResolver(undefined, tree).getComponentsFromPath('.');
      components = await this.getConvertedComponents(zipComponents, options);
    }

    const sourceRetrieveResult = this.buildSourceRetrieveResult(retrieveResult, components);
    return sourceRetrieveResult;
  }

  private formatRetrieveRequest(components: SourceComponent[]): RetrieveRequest {
    const manifestGenerator = new ManifestGenerator(this.resolver, this.registry);
    const manifest = manifestGenerator.createManifest(components);
    const manifestJson = parse(manifest);
    const packageData = manifestJson.Package;
    delete packageData.$;

    const retrieveRequest = {
      apiVersion: this.registry.apiVersion,
      unpackaged: packageData,
    };
    return retrieveRequest;
  }

  private async getRetrievedResult(
    retrieveRequest: RetrieveRequest,
    options: RetrieveOptions
  ): Promise<RetrieveResult> {
    // @ts-ignore required callback
    const retrieveId = (await this.connection.metadata.retrieve(retrieveRequest)).id;
    const retrieveResult = await this.metadataRetrieveStatusPoll(retrieveId, options);
    return retrieveResult;
  }

  private async metadataRetrieveStatusPoll(
    retrieveID: string,
    options: RetrieveOptions,
    interval = 100
  ): Promise<RetrieveResult> {
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
        // Recasting to use the library's RetrieveResult type
        result = ((await this.connection.metadata.checkRetrieveStatus(
          retrieveID
        )) as unknown) as RetrieveResult;
      } catch (e) {
        throw new RetrieveError('md_request_fail', e);
      }

      switch (result.status) {
        case RetrieveStatus.Succeeded:
        case RetrieveStatus.Failed:
          return result;
        case RetrieveStatus.InProgress:
      }

      triedOnce = true;
    } while (Date.now() < endTime);

    return result;
  }

  private buildSourceRetrieveResult(
    retrieveResult: RetrieveResult,
    retrievedComponents: SourceComponent[]
  ): SourceRetrieveResult {
    const retrievedSet = new ComponentSet(retrievedComponents);
    const successes: RetrieveSuccess[] = [];
    const failures: RetrieveFailure[] = [];

    if (retrieveResult.messages) {
      const retrieveMessages = Array.isArray(retrieveResult.messages)
        ? retrieveResult.messages
        : [retrieveResult.messages];

      for (const message of retrieveMessages) {
        // match type name and fullname of problem component
        const matches = message.problem.match(/.+'(.+)'.+'(.+)'/);
        if (matches) {
          const [typeName, fullName] = matches.slice(1);
          failures.push({
            component: {
              fullName,
              type: this.registry.getTypeByName(typeName),
            },
            message: message.problem,
          });
        } else {
          failures.push({ message: message.problem });
        }
      }
    }

    if (retrieveResult.fileProperties) {
      const fileProperties = Array.isArray(retrieveResult.fileProperties)
        ? retrieveResult.fileProperties
        : [retrieveResult.fileProperties];
      for (const properties of fileProperties) {
        // not interested in the "Package" component at this time
        if (properties.type === 'Package') {
          continue;
        }
        successes.push({
          properties,
          component: retrievedSet.get({
            fullName: properties.fullName,
            type: this.registry.getTypeByName(properties.type),
          }),
        });
      }
    }

    let status = retrieveResult.status;
    if (failures.length > 0) {
      if (successes.length > 0) {
        status = RetrieveStatus.PartialSuccess;
      } else {
        status = RetrieveStatus.Failed;
      }
    }

    return {
      id: retrieveResult.id,
      status,
      successes,
      failures,
      success: status === RetrieveStatus.Succeeded || status === RetrieveStatus.PartialSuccess,
    };
  }

  private async getConvertedComponents(
    retrievedComponents: SourceComponent[],
    options: RetrieveOptions
  ): Promise<SourceComponent[]> {
    const converter = new MetadataConverter();
    const outputConfig: ConvertOutputConfig = options.merge
      ? {
          type: 'merge',
          mergeWith: options.components,
          defaultDirectory: options.output,
        }
      : {
          type: 'directory',
          outputDirectory: options.output,
        };
    const convertResult = await converter.convert(retrievedComponents, 'source', outputConfig);
    return convertResult.converted;
  }

  private hashElement(component: SourceComponent): string {
    const hashed = `${component.fullName}.${component.type.id}`;
    return hashed;
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
            diagnosticUtil.setDeployDiagnostic(componentDeployment, message);
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
