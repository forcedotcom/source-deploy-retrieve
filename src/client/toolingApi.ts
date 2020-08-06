/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { getDeployStrategy } from './deployStrategies';
import { SourceClientError } from '../errors';
import { SourcePath } from '../types';
import { nls } from '../i18n';
import { buildQuery, queryToFileMap } from './retrieveUtil';
import { createFiles } from '../utils';
import { SourceComponent } from '../metadata-registry';
import {
  BaseApi,
  RetrieveOptions,
  RetrievePathOptions,
  ApiResult,
  ToolingDeployOptions,
  SourceDeployResult,
  QueryResult,
} from './types';

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

export class ToolingApi extends BaseApi {
  public async retrieveWithPaths(options: RetrievePathOptions): Promise<ApiResult> {
    const retrievePaths = options.paths[0];
    return await this.retrieve({
      output: options.output,
      namespace: options.namespace,
      components: this.registry.getComponentsFromPath(retrievePaths),
    });
  }

  public async retrieve(options: RetrieveOptions): Promise<ApiResult> {
    let retrieveResult: ApiResult;
    if (options.components.length > 1) {
      const retrieveError = new Error();
      retrieveError.message = nls.localize('tapi_retrieve_component_limit_error');
      retrieveError.name = 'MetadataRetrieveLimit';
      throw retrieveError;
    }
    const mdComponent: SourceComponent = options.components[0];

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
          success: true,
          components: [],
          message: nls.localize('error_md_not_present_in_org', mdComponent.fullName),
        };
      }

      const saveFilesMap = queryToFileMap(queryResult, mdComponent, options.output);
      createFiles(saveFilesMap);

      retrieveResult = {
        success: true,
        components: [mdComponent],
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
    return this.deploy(this.registry.getComponentsFromPath(path), options);
  }
}
