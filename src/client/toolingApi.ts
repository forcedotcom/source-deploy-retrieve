/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getDeployStrategy } from './deployStrategies';
import { SourceClientError } from '../errors';
import {
  BaseApi,
  RetrievePathOptions,
  ApiResult,
  DeployOptions,
  DeployPathOptions,
  DeployResult,
  RetrieveOptions,
  MetadataComponent,
  QueryResult
} from '../types';
import { nls } from '../i18n';
import { createFiles } from '../utils';
import { supportedToolingTypes } from '../utils/deploy';
import { buildQuery, queryToFileMap } from './retrieveUtil';

// TODO: consolidate this with supported types in deploy
const supportedTypes = new Set([
  'ApexClass',
  'ApexTrigger',
  'ApexPage',
  'ApexComponent'
]);

export class ToolingApi extends BaseApi {
  public async retrieveWithPaths(
    options: RetrievePathOptions
  ): Promise<ApiResult> {
    const retrievePaths = options.paths[0];
    return await this.retrieve({
      output: options.output,
      components: this.registry.getComponentsFromPath(retrievePaths)
    });
  }

  public async retrieve(options: RetrieveOptions): Promise<ApiResult> {
    let retrieveResult: ApiResult;
    if (options.components.length > 1) {
      const retrieveError = new Error();
      retrieveError.message = nls.localize(
        'tapi_retrieve_component_limit_error'
      );
      retrieveError.name = 'MetadataRetrieveLimit';
      throw retrieveError;
    }
    const mdComponent: MetadataComponent = options.components[0];

    if (!supportedTypes.has(mdComponent.type.name)) {
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
        buildQuery(mdComponent)
      )) as QueryResult;

      if (queryResult && queryResult.records.length === 0) {
        return {
          success: true,
          components: [],
          message: nls.localize(
            'error_md_not_present_in_org',
            mdComponent.fullName
          )
        };
      }

      const saveFilesMap = queryToFileMap(
        queryResult,
        mdComponent,
        options.output
      );
      createFiles(saveFilesMap);

      retrieveResult = {
        success: true,
        components: [mdComponent]
      };
    } catch (err) {
      throw new Error(nls.localize('error_in_tooling_retrieve', err));
    }

    return retrieveResult;
  }

  public async deploy(options: DeployOptions): Promise<DeployResult> {
    if (options.components.length > 1) {
      const deployError = new SourceClientError(
        'tapi_deploy_component_limit_error'
      );
      throw deployError;
    }
    const mdComponent: MetadataComponent = options.components[0];
    const metadataType = mdComponent.type.name;

    if (supportedToolingTypes.get(metadataType) === undefined) {
      throw new SourceClientError(
        'beta_tapi_membertype_unsupported_error',
        metadataType
      );
    }

    const deployStrategy = getDeployStrategy(metadataType, this.connection);
    return deployStrategy.deploy(mdComponent);
  }

  public async deployWithPaths(
    options: DeployPathOptions
  ): Promise<DeployResult> {
    const deployPaths = options.paths[0];
    return await this.deploy({
      components: this.registry.getComponentsFromPath(deployPaths)
    });
  }
}
