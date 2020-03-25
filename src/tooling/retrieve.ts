/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import { nls } from '../i18n';
import { RegistryAccess, MetadataComponent } from '../metadata-registry';
import { QueryResult } from '../types';
import { createMetadataFile } from '../utils';

export type ToolingRetrieveResult = {
  size: number;
  done: boolean;
  entityTypeName: string;
  records: string[];
};

export class Retrieve {
  private connection: Connection;
  private mdComponent: MetadataComponent[];

  constructor(connection: Connection) {
    this.connection = connection;
  }

  public async getMetadata(sourcePath: string): Promise<ToolingRetrieveResult> {
    let retrieveResult: ToolingRetrieveResult;
    const registry = new RegistryAccess();
    this.mdComponent = registry.getComponentsFromPath(sourcePath);

    try {
      const queryResult = (await this.connection.tooling.query(
        this.buildQuery()
      )) as QueryResult;

      if (queryResult && queryResult.records.length === 0) {
        throw new Error(
          nls.localize('error_md_not_present_in_org', sourcePath)
        );
      }

      const mdSourcePath = this.mdComponent[0].sources[0];
      createMetadataFile(mdSourcePath, queryResult.records[0].Body);
      const metaXMLFile = `<ApexClass></ApexClass>`;
      createMetadataFile(`${mdSourcePath}-meta.xml`, metaXMLFile);

      retrieveResult = {
        size: this.mdComponent[0].sources.length,
        done: true,
        entityTypeName: this.mdComponent[0].type.name,
        records: this.mdComponent[0].sources
      };
    } catch (err) {
      throw new Error(nls.localize('error_in_tooling_retrieve', err));
    }

    return retrieveResult;
  }

  public buildQuery(): string {
    return `Select Id, ApiVersion, Body, Name, NamespacePrefix, Status from ${
      this.mdComponent[0].type.name
    } where Name = '${this.mdComponent[0].fullName}'`;
  }
}
