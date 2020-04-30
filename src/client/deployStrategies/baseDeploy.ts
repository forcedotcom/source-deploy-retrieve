/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import { readFileSync } from 'fs';
import { sep } from 'path';
import {
  DeployResult,
  MetadataComponent,
  SourceResult,
  DeployStatusEnum
} from '../../types';
import { ToolingCreateResult } from '../../utils/deploy';
import { DeployError } from '../../errors';

// tslint:disable-next-line:no-var-requires
const DOMParser = require('xmldom-sfdx-encoding').DOMParser;

export abstract class BaseDeploy {
  public connection: Connection;
  public component: MetadataComponent;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  public abstract deploy(component: MetadataComponent): Promise<DeployResult>;

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

  protected async createBundle(): Promise<ToolingCreateResult> {
    const metadataContent = readFileSync(this.component.xml, 'utf8');
    const metadataField = this.buildMetadataField(metadataContent);
    const bundleObject = {
      FullName: this.component.fullName,
      Metadata: metadataField
    };

    const newBundle = await this.toolingCreate(
      this.component.type.name,
      bundleObject
    );

    if (!newBundle.success) {
      throw new DeployError(
        'error_creating_metadata_type',
        this.component.type.name
      );
    }

    return newBundle;
  }

  protected formatBundleOutput(
    deployResults: SourceResult[],
    failure?: boolean
  ): DeployResult {
    let toolingDeployResult: DeployResult;
    if (failure) {
      toolingDeployResult = {
        State: DeployStatusEnum.Failed,
        ErrorMsg: deployResults[0].problem,
        DeployDetails: {
          componentSuccesses: [],
          componentFailures: deployResults
        },
        isDeleted: false,
        metadataFile: this.component.xml
      };
    } else {
      toolingDeployResult = {
        State: DeployStatusEnum.Completed,
        DeployDetails: {
          componentSuccesses: deployResults,
          componentFailures: []
        },
        isDeleted: false,
        outboundFiles: this.component.sources,
        ErrorMsg: null,
        metadataFile: this.component.xml
      };
    }
    return toolingDeployResult;
  }

  protected createDeployResult(
    filepath: string,
    success: boolean,
    created: boolean,
    problem?: string
  ): SourceResult {
    const formattedPaths = this.getFormattedPaths(filepath);
    const result = {
      success,
      deleted: false,
      fileName: filepath,
      fullName: formattedPaths[1],
      componentType: this.component.type.name
    } as SourceResult;

    if (success) {
      result['created'] = created;
      result['changed'] = !created;
    } else {
      result['problem'] = problem;
      result['changed'] = false;
      result['created'] = false;
    }
    return result;
  }

  protected getFormattedPaths(filepath: string): string[] {
    const pathParts = filepath.split(sep);

    const typeFolderIndex = pathParts.findIndex(
      part => part === this.component.type.directoryName
    );

    return [
      pathParts.slice(typeFolderIndex).join(sep),
      pathParts.slice(typeFolderIndex + 1).join(sep)
    ];
  }
}
