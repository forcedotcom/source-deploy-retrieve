/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Connection } from '@salesforce/core';
import { readFileSync } from 'fs';
import { sep } from 'path';
import { DeployError } from '../../errors';
import { ToolingCreateResult } from '../../utils/deploy';
import { SourceComponent } from '../../resolve';
import { SourceDeployResult } from '../types';

// tslint:disable-next-line:no-var-requires
const DOMParser = require('xmldom-sfdx-encoding').DOMParser;

export abstract class BaseDeploy {
  private static readonly TOOLING_PATH_SEP = '/';

  public connection: Connection;
  public component: SourceComponent;
  public namespace: string;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  public buildMetadataField(
    metadataContent: string
  ): {
    label?: string;
    packageVersions?: string;
    status?: string;
    apiVersion: string;
  } {
    try {
      const parser = new DOMParser();
      const document = parser.parseFromString(metadataContent, 'text/xml');
      const apiVersion = document.getElementsByTagName('apiVersion')[0].textContent;
      const statusNode = document.getElementsByTagName('status')[0];
      const packageNode = document.getElementsByTagName('packageVersions')[0];
      const descriptionNode = document.getElementsByTagName('description')[0];
      const labelNode = document.getElementsByTagName('label')[0];

      const metadataField = {
        apiVersion,
        ...(statusNode ? { status: statusNode.textContent } : {}),
        ...(packageNode ? { packageVersions: packageNode.textContent } : {}),
        ...(descriptionNode ? { description: descriptionNode.textContent } : {}),
        ...(labelNode ? { label: labelNode.textContent } : {}),
      };
      return metadataField;
    } catch (e) {
      throw new DeployError('error_parsing_metadata_file');
    }
  }

  // If bundle already exists then use Id and update existing
  // else, create a new bundle
  public async upsertBundle(Id?: string): Promise<ToolingCreateResult> {
    const metadataContent = readFileSync(this.component.xml, 'utf8');
    const metadataField = this.buildMetadataField(metadataContent);

    let bundleResult: ToolingCreateResult;
    if (Id) {
      const bundleObject = { Id, Metadata: metadataField };

      bundleResult = (await this.connection.tooling.update(
        this.component.type.name,
        bundleObject
      )) as ToolingCreateResult;
    } else {
      const bundleObject = {
        FullName: this.component.fullName,
        Metadata: metadataField,
      };

      bundleResult = await this.toolingCreate(this.component.type.name, bundleObject);
    }

    if (!bundleResult.success) {
      throw new DeployError('error_creating_metadata_type', this.component.type.name);
    }

    return bundleResult;
  }

  protected async toolingCreate(type: string, record: object): Promise<ToolingCreateResult> {
    return (await this.connection.tooling.create(type, record)) as ToolingCreateResult;
  }

  protected getFormattedPaths(filepath: string): string[] {
    const pathParts = filepath.split(sep);

    const typeFolderIndex = pathParts.findIndex(
      (part) => part === this.component.type.directoryName
    );

    return [
      pathParts.slice(typeFolderIndex).join(BaseDeploy.TOOLING_PATH_SEP),
      pathParts.slice(typeFolderIndex + 1).join(BaseDeploy.TOOLING_PATH_SEP),
    ];
  }

  public abstract deploy(
    component: SourceComponent,
    namespace: string
  ): Promise<SourceDeployResult>;
}
