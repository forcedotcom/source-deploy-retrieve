/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import { MetadataComponent } from '../../types';
import { ToolingCreateResult, ToolingDeployResult } from './index';
import { DeployError } from '../../errors';

// tslint:disable-next-line:no-var-requires
const DOMParser = require('xmldom-sfdx-encoding').DOMParser;

export abstract class BaseDeploy {
  public connection: Connection;
  public component: MetadataComponent;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  public abstract deploy(
    component: MetadataComponent
  ): Promise<ToolingDeployResult>;

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
      const apiVersion = document.getElementsByTagName('apiVersion')[0]
        .textContent;
      const statusNode = document.getElementsByTagName('status')[0];
      const packageNode = document.getElementsByTagName('packageVersions')[0];
      const descriptionNode = document.getElementsByTagName('description')[0];
      const labelNode = document.getElementsByTagName('label')[0];

      const metadataField = {
        apiVersion,
        ...(statusNode ? { status: statusNode.textContent } : {}),
        ...(packageNode ? { packageVersions: packageNode.textContent } : {}),
        ...(descriptionNode
          ? { description: descriptionNode.textContent }
          : {}),
        ...(labelNode ? { label: labelNode.textContent } : {})
      };
      return metadataField;
    } catch (e) {
      throw new DeployError('error_parsing_metadata_file');
    }
  }

  protected async toolingCreate(
    type: string,
    record: object
  ): Promise<ToolingCreateResult> {
    return (await this.connection.tooling.create(
      type,
      record
    )) as ToolingCreateResult;
  }
}
