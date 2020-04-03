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
  RetrieveOptions
} from '../client/client';
import { RegistryAccess, MetadataComponent } from '../metadata-registry';
import { QueryResult } from '../types';
import { nls } from '../i18n';
import { createMetadataFile } from '../utils';

const metaXMLTemplate = `<{typeName}></{typeName}>`;

export class ToolingApi extends BaseApi {
  public async retrieveWithPaths(
    options: RetrievePathOptions
  ): Promise<ApiResult> {
    let retrieveResult: ApiResult;
    console.log('options ', options);
    const retrievePaths = options.paths[0];
    const registry = new RegistryAccess();
    const mdComponent = registry.getComponentsFromPath(retrievePaths);

    try {
      const queryResult = (await this.connection.tooling.query(
        this.buildQuery(mdComponent)
      )) as QueryResult;

      if (queryResult && queryResult.records.length === 0) {
        throw new Error(
          nls.localize('error_md_not_present_in_org', retrievePaths)
        );
      }

      const mdSourcePath = mdComponent[0].sources[0];
      createMetadataFile(mdSourcePath, queryResult.records[0].Body);
      const metaXMLFile = metaXMLTemplate.replace('{typeName}', 'ApexClass');
      createMetadataFile(`${mdSourcePath}-meta.xml`, metaXMLFile);

      retrieveResult = {
        success: true,
        components: mdComponent,
        message: 'success and not less'
      };
    } catch (err) {
      throw new Error(nls.localize('error_in_tooling_retrieve', err));
    }

    return retrieveResult;
  }

  retrieve(options: RetrieveOptions): ApiResult {
    console.log('options ', options);
    throw new Error('Method not implemented.');
  }

  public buildQuery(mdComponent: MetadataComponent[]): string {
    return `Select Id, ApiVersion, Body, Name, NamespacePrefix, Status from ${
      mdComponent[0].type.name
    } where Name = '${mdComponent[0].fullName}'`;
  }
}
