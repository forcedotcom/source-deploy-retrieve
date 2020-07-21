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
import { DeployResult, DeployStatusEnum, SourceResult } from '../../types';
import { ToolingCreateResult } from '../../utils/deploy';
import { TOOLING_PATH_SEP } from './constants';
import { SourceComponent } from '../../metadata-registry';
import { ToolingSourceDeployResult } from '../../types/newClient';

// tslint:disable-next-line:no-var-requires
const DOMParser = require('xmldom-sfdx-encoding').DOMParser;

export abstract class BaseDeploy {
  public connection: Connection;
  public component: SourceComponent;
  public namespace: string;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  public abstract deploy(
    component: SourceComponent,
    namespace: string
  ): Promise<DeployResult | ToolingSourceDeployResult>;

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
        ...(labelNode ? { label: labelNode.textContent } : {})
      };
      return metadataField;
    } catch (e) {
      throw new DeployError('error_parsing_metadata_file');
    }
  }

  protected async toolingCreate(type: string, record: object): Promise<ToolingCreateResult> {
    return (await this.connection.tooling.create(type, record)) as ToolingCreateResult;
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
        Metadata: metadataField
      };

      bundleResult = await this.toolingCreate(this.component.type.name, bundleObject);
    }

    if (!bundleResult.success) {
      throw new DeployError('error_creating_metadata_type', this.component.type.name);
    }

    return bundleResult;
  }

  protected formatBundleOutput(deployResults: SourceResult[], failure?: boolean): DeployResult {
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
      const outboundFiles = this.component.walkContent();
      outboundFiles.push(this.component.xml);
      toolingDeployResult = {
        State: DeployStatusEnum.Completed,
        DeployDetails: {
          componentSuccesses: deployResults,
          componentFailures: []
        },
        isDeleted: false,
        outboundFiles,
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

    const typeFolderIndex = pathParts.findIndex(part => part === this.component.type.directoryName);

    return [
      pathParts.slice(typeFolderIndex).join(TOOLING_PATH_SEP),
      pathParts.slice(typeFolderIndex + 1).join(TOOLING_PATH_SEP)
    ];
  }
}
