/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Connection, Messages, SfError } from '@salesforce/core';
import { SourcePath } from '../common';
import { createFiles } from '../utils';
import { MetadataResolver, SourceComponent } from '../resolve';
import { ComponentSet } from '../collections';
import { RegistryAccess } from '../registry';
import { QueryResult, RequestStatus, SourceDeployResult, SourceRetrieveResult } from './types';
import { buildQuery, queryToFileMap } from './retrieveUtil';
import { getDeployStrategy } from './deployStrategies';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.load('@salesforce/source-deploy-retrieve', 'sdr', [
  'beta_tapi_membertype_unsupported_error',
  'tapi_deploy_component_limit_error',
  'tapi_retrieve_component_limit_error',
  'error_in_tooling_retrieve',
  'error_md_not_present_in_org',
]);

type WithNamespace = { namespace?: string };
export type ToolingDeployOptions = WithNamespace;
export type ToolingRetrieveOptions = WithNamespace & { output?: string };

const retrieveTypes = new Set([
  'ApexClass',
  'ApexTrigger',
  'ApexPage',
  'ApexComponent',
  'AuraDefinitionBundle',
  'LightningComponentBundle',
]);

export const deployTypes = new Map([
  ['ApexClass', 'ApexClassMember'],
  ['ApexTrigger', 'ApexTriggerMember'],
  ['ApexPage', 'ApexPageMember'],
  ['ApexComponent', 'ApexComponentMember'],
  ['AuraDefinitionBundle', 'AuraDefinition'],
  ['LightningComponentBundle', 'LightningComponentResource'],
]);

export class ToolingApi {
  public constructor(
    protected connection: Connection,
    protected resolver: MetadataResolver,
    protected registry = new RegistryAccess()
  ) {}

  public async retrieveWithPaths(options: ToolingRetrieveOptions & { paths: string[] }): Promise<SourceRetrieveResult> {
    return this.retrieve({
      output: options.output,
      namespace: options.namespace,
      components: ComponentSet.fromSource({ fsPaths: [options.paths[0]], registry: this.registry }),
    });
  }

  public async retrieve(options: ToolingRetrieveOptions & { components: ComponentSet }): Promise<SourceRetrieveResult> {
    let retrieveResult: SourceRetrieveResult;
    if (options.components.size > 1) {
      throw new SfError(messages.getMessage('tapi_retrieve_component_limit_error'), 'MetadataRetrieveLimit');
    }
    const mdComponent: SourceComponent = options.components.getSourceComponents().first();

    if (!retrieveTypes.has(mdComponent.type.name)) {
      throw new SfError(
        messages.getMessage('beta_tapi_membertype_unsupported_error', [mdComponent.type.name]),
        'MetadataTypeUnsupported'
      );
    }

    try {
      const queryResult = (await this.connection.tooling.query(
        buildQuery(mdComponent, options.namespace)
      )) as QueryResult;

      if (queryResult && queryResult.records.length === 0) {
        return {
          status: RequestStatus.Failed,
          success: false,
          successes: [],
          failures: [
            {
              component: {
                fullName: mdComponent.fullName,
                type: mdComponent.type,
              },
              message: messages.getMessage('error_md_not_present_in_org', [mdComponent.fullName]),
            },
          ],
        };
      }

      const saveFilesMap = queryToFileMap(queryResult, mdComponent, options.output);
      createFiles(saveFilesMap);

      retrieveResult = {
        status: RequestStatus.Succeeded,
        success: true,
        successes: [{ component: mdComponent }],
        failures: [],
      };
    } catch (err) {
      const error = err as Error;
      throw new SfError(messages.getMessage('error_in_tooling_retrieve'), error.name, [], err, err);
    }

    return retrieveResult;
  }

  public async deploy(
    components: SourceComponent | SourceComponent[],
    options?: ToolingDeployOptions
  ): Promise<SourceDeployResult> {
    let mdComponent: SourceComponent;
    if (Array.isArray(components)) {
      if (components.length > 1) {
        throw new SfError(messages.getMessage('tapi_deploy_component_limit_error'), 'SourceClientError');
      }
      mdComponent = components[0];
    } else {
      mdComponent = components;
    }
    const metadataType = mdComponent.type.name;

    if (!deployTypes.get(metadataType)) {
      throw new SfError(
        messages.getMessage('beta_tapi_membertype_unsupported_error', [metadataType]),
        'SourceClientError'
      );
    }

    const deployStrategy = getDeployStrategy(metadataType, this.connection);
    const namespace = options && options.namespace ? options.namespace : '';
    return deployStrategy.deploy(mdComponent, namespace);
  }

  public async deployWithPaths(path: SourcePath, options?: ToolingDeployOptions): Promise<SourceDeployResult> {
    return this.deploy(this.resolver.getComponentsFromPath(path), options);
  }
}
