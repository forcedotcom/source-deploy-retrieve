/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { getDeployStrategy } from './deployStrategies';
import { SourceClientError } from '../errors';
import { SourcePath } from '../common';
import { nls } from '../i18n';
import { buildQuery, queryToFileMap } from './retrieveUtil';
import { createFiles } from '../utils';
import { MetadataResolver, RegistryAccess, SourceComponent } from '../metadata-registry';
import { SourceDeployResult, QueryResult, SourceRetrieveResult, RequestStatus } from './types';
import { ComponentSet } from '../collections';
import { Connection } from '@salesforce/core';

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
  protected connection: Connection;
  protected resolver: MetadataResolver;
  protected registry: RegistryAccess;

  constructor(connection: Connection, resolver: MetadataResolver, registry = new RegistryAccess()) {
    this.connection = connection;
    this.resolver = resolver;
    this.registry = registry;
  }

  public async retrieveWithPaths(
    options: ToolingRetrieveOptions & { paths: string[] }
  ): Promise<SourceRetrieveResult> {
    return this.retrieve({
      output: options.output,
      namespace: options.namespace,
      components: ComponentSet.fromSource(options.paths[0], { registry: this.registry }),
    });
  }

  public async retrieve(
    options: ToolingRetrieveOptions & { components: ComponentSet }
  ): Promise<SourceRetrieveResult> {
    let retrieveResult: SourceRetrieveResult;
    if (options.components.size > 1) {
      const retrieveError = new Error();
      retrieveError.message = nls.localize('tapi_retrieve_component_limit_error');
      retrieveError.name = 'MetadataRetrieveLimit';
      throw retrieveError;
    }
    const mdComponent: SourceComponent = options.components.getSourceComponents().next().value;

    if (!retrieveTypes.has(mdComponent.type.name)) {
      const retrieveError = new Error();
      retrieveError.message = nls.localize(
        'beta_tapi_membertype_unsupported_error',
        mdComponent.type.name
      );
      retrieveError.name = 'MetadataTypeUnsupported';
      throw retrieveError;
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
              message: nls.localize('error_md_not_present_in_org', mdComponent.fullName),
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
      throw new Error(nls.localize('error_in_tooling_retrieve', err));
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
        const deployError = new SourceClientError('tapi_deploy_component_limit_error');
        throw deployError;
      }
      mdComponent = components[0];
    } else {
      mdComponent = components;
    }
    const metadataType = mdComponent.type.name;

    if (!deployTypes.get(metadataType)) {
      throw new SourceClientError('beta_tapi_membertype_unsupported_error', metadataType);
    }

    const deployStrategy = getDeployStrategy(metadataType, this.connection);
    const namespace = options && options.namespace ? options.namespace : '';
    return deployStrategy.deploy(mdComponent, namespace);
  }

  public async deployWithPaths(
    path: SourcePath,
    options?: ToolingDeployOptions
  ): Promise<SourceDeployResult> {
    return this.deploy(this.resolver.getComponentsFromPath(path), options);
  }
}
