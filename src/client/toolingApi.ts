/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  BaseApi,
  RetrievePathOptions,
  ApiResult,
  RetrieveOptions,
  QueryResult,
  MetadataComponent
} from '../types';
import { RegistryAccess } from '../metadata-registry';
import { nls } from '../i18n';
import {
  createMetadataFile,
  generateMetaXML,
  generateMetaXMLPath
} from '../utils';

export class ToolingApi extends BaseApi {
  protected mdComponent: MetadataComponent[];

  public async retrieveWithPaths(
    options: RetrievePathOptions
  ): Promise<ApiResult> {
    const retrievePaths = options.paths[0];
    const registry = new RegistryAccess();
    return await this.retrieve({
      output: options.paths[0],
      components: registry.getComponentsFromPath(retrievePaths)
    });
  }

  public async retrieve(options: RetrieveOptions): Promise<ApiResult> {
    let retrieveResult: ApiResult;
    this.mdComponent = options.components;

    try {
      const queryResult = (await this.connection.tooling.query(
        this.buildQuery()
      )) as QueryResult;

      if (queryResult && queryResult.records.length === 0) {
        return {
          success: true,
          components: [],
          message: nls.localize('error_md_not_present_in_org', options.output)
        };
      }

      const mdSourcePath = this.mdComponent[0].sources[0];
      createMetadataFile(mdSourcePath, queryResult.records[0].Body);
      createMetadataFile(
        generateMetaXMLPath(mdSourcePath),
        generateMetaXML(
          this.mdComponent[0].type.name,
          queryResult.records[0].ApiVersion,
          queryResult.records[0].Status
        )
      );

      retrieveResult = {
        success: true,
        components: this.mdComponent
      };
    } catch (err) {
      throw new Error(nls.localize('error_in_tooling_retrieve', err));
    }

    return retrieveResult;
  }

  protected buildQuery(): string {
    return `Select Id, ApiVersion, Body, Name, NamespacePrefix, Status from ${this.mdComponent[0].type.name} where Name = '${this.mdComponent[0].fullName}'`;
  }
}
