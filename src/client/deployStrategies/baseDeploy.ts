/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint @typescript-eslint/no-unsafe-assignment:0, @typescript-eslint/no-unsafe-call:0, @typescript-eslint/no-unsafe-member-access:0  */
import { sep } from 'path';
import { Connection, Messages, SfError } from '@salesforce/core';
import { readFileSync } from 'graceful-fs';
import { SaveResult } from 'jsforce';
import { DOMParser } from '@xmldom/xmldom';
import { SourceComponent } from '../../resolve';
import { SourceDeployResult } from '../types';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.load('@salesforce/source-deploy-retrieve', 'sdr', [
  'error_parsing_metadata_file',
  'error_creating_metadata_type',
]);

export abstract class BaseDeploy {
  private static readonly TOOLING_PATH_SEP = '/';

  public connection: Connection;
  public component: SourceComponent;
  public namespace: string;

  public constructor(connection: Connection) {
    this.connection = connection;
  }

  // eslint-disable-next-line class-methods-use-this
  public buildMetadataField(metadataContent: string): {
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

      return {
        apiVersion,
        ...(statusNode ? { status: statusNode.textContent } : {}),
        ...(packageNode ? { packageVersions: packageNode.textContent } : {}),
        ...(descriptionNode ? { description: descriptionNode.textContent } : {}),
        ...(labelNode ? { label: labelNode.textContent } : {}),
      };
    } catch (e) {
      throw new SfError(messages.getMessage('error_parsing_metadata_file'), 'DeployError');
    }
  }

  // If bundle already exists then use Id and update existing
  // else, create a new bundle
  public async upsertBundle(Id?: string): Promise<SaveResult> {
    const metadataContent = readFileSync(this.component.xml, 'utf8');
    const metadataField = this.buildMetadataField(metadataContent);

    let bundleResult: SaveResult;
    if (Id) {
      const bundleObject = { Id, Metadata: metadataField };

      bundleResult = await this.connection.tooling.update(this.component.type.name, bundleObject);
    } else {
      const bundleObject = {
        FullName: this.component.fullName,
        Metadata: metadataField,
      };

      bundleResult = await this.toolingCreate(this.component.type.name, bundleObject);
    }

    if (!bundleResult.success) {
      throw new SfError(messages.getMessage('error_creating_metadata_type', [this.component.type.name]), 'DeployError');
    }

    return bundleResult;
  }

  protected async toolingCreate(type: string, record: Record<string, unknown>): Promise<SaveResult> {
    return this.connection.tooling.create(type, record);
  }

  protected getFormattedPaths(filepath: string): string[] {
    const pathParts = filepath.split(sep);

    const typeFolderIndex = pathParts.findIndex((part) => part === this.component.type.directoryName);

    return [
      pathParts.slice(typeFolderIndex).join(BaseDeploy.TOOLING_PATH_SEP),
      pathParts.slice(typeFolderIndex + 1).join(BaseDeploy.TOOLING_PATH_SEP),
    ];
  }

  public abstract deploy(component: SourceComponent, namespace: string): Promise<SourceDeployResult>;
}
