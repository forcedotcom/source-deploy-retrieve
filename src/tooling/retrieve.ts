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

export class Retrieve {
  private connection: Connection;
  private mdComponent: MetadataComponent[];

  constructor(connection: Connection) {
    this.connection = connection;
  }

  public async getMetadata(sourcePath: string): Promise<string> {
    const registry = new RegistryAccess();
    this.mdComponent = registry.getComponentsFromPath(sourcePath);

    const mdSourcePath = this.mdComponent[0].sources[0];
    try {
      const queryResult = (await this.connection.tooling.query(
        this.buildQuery()
      )) as QueryResult;

      if (queryResult && queryResult.records.length === 0) {
        throw new Error(
          nls.localize('error_md_not_present_in_org', sourcePath)
        );
      }

      createMetadataFile(mdSourcePath, queryResult.records[0].Body);
      const metaXMLFile = `<ApexClass></ApexClass>`;
      createMetadataFile(`${mdSourcePath}-meta.xml`, metaXMLFile);
    } catch (err) {
      throw new Error(nls.localize('error_in_tooling_retrieve', err));
    }

    return mdSourcePath;
  }

  public buildQuery(): string {
    return `Select Id, ApiVersion, Body, Name, NamespacePrefix, Status from ${
      this.mdComponent[0].type.name
    } where Name = '${this.mdComponent[0].fullName}'`;
  }
}
