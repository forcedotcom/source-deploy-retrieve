/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import * as fs from 'fs';
import * as path from 'path';
import { nls } from '../i18n';
import {
  DeployStatusEnum,
  supportedToolingTypes,
  ToolingCreateResult,
  ToolingDeployResult
} from './index';
import { RegistryAccess } from '../metadata-registry/index';
// tslint:disable-next-line:no-var-requires
const DOMParser = require('xmldom-sfdx-encoding').DOMParser;
const CONTAINER_ASYNC_REQUEST = 'ContainerAsyncRequest';
const METADATA_CONTAINER = 'MetadataContainer';

export class Deploy {
  public metadataType: string;
  public connection: Connection;
  private apiVersion: string;
  private registryAccess: RegistryAccess;

  public constructor(
    connection: Connection,
    apiVersion?: string,
    registryAccess?: RegistryAccess
  ) {
    this.connection = connection;
    this.apiVersion = apiVersion;
    if (registryAccess) {
      this.registryAccess = registryAccess;
    } else {
      this.registryAccess = new RegistryAccess();
    }
  }

  public async deploy(filePath: string): Promise<ToolingDeployResult> {
    const component = this.registryAccess.getComponentsFromPath(filePath)[0];
    this.metadataType = component.type.name;
    const sourcePath = component.sources[0];
    const metadataPath = component.metaXml;

    if (supportedToolingTypes.get(this.metadataType) === undefined) {
      const deployFailed = new Error();
      deployFailed.message = nls.localize(
        'beta_tapi_membertype_unsupported_error',
        this.metadataType
      );
      deployFailed.name = 'MetadataTypeUnsupported';
      throw deployFailed;
    }

    const container = await this.createMetadataContainer();
    await this.createContainerMember([sourcePath, metadataPath], container);
    const asyncRequest = await this.createContainerAsyncRequest(container);
    const output = await this.toolingStatusCheck(asyncRequest);
    return output;
  }

  public async createMetadataContainer(): Promise<ToolingCreateResult> {
    const metadataContainer = await this.toolingCreate(METADATA_CONTAINER, {
      Name: `VSCode_MDC_${Date.now()}`
    });

    if (!metadataContainer.success) {
      const deployFailed = new Error();
      deployFailed.message = nls.localize('beta_tapi_mdcontainer_error');
      deployFailed.name = 'MetadataContainerCreationFailed';
      throw deployFailed;
    }
    return metadataContainer;
  }

  private async toolingCreate(
    type: string,
    record: object
  ): Promise<ToolingCreateResult> {
    return (await this.connection.tooling.create(
      type,
      record
    )) as ToolingCreateResult;
  }

  public buildMetadataField(
    metadataContent: string
  ): {
    label?: string;
    packageVersions?: string;
    status?: string;
    apiVersion: string;
  } {
    const parser = new DOMParser();
    const document = parser.parseFromString(metadataContent, 'text/xml');
    const apiVersion =
      this.apiVersion ||
      document.getElementsByTagName('apiVersion')[0].textContent;
    const statusNode = document.getElementsByTagName('status')[0];
    const packageNode = document.getElementsByTagName('packageVersions')[0];
    const labelNode = document.getElementsByTagName('label')[0];

    const metadataField = {
      apiVersion,
      ...(statusNode ? { status: statusNode.textContent } : {}),
      ...(packageNode ? { packageVersions: packageNode.textContent } : {}),
      ...(labelNode ? { label: labelNode.textContent } : {})
    };
    return metadataField;
  }

  public async createContainerMember(
    outboundFiles: string[],
    container: ToolingCreateResult
  ): Promise<ToolingCreateResult> {
    const id = container.id;
    const metadataContent = fs.readFileSync(outboundFiles[1], 'utf8');
    const metadataField = this.buildMetadataField(metadataContent);
    const body = fs.readFileSync(outboundFiles[0], 'utf8');
    const fileName = path.basename(
      outboundFiles[0],
      path.extname(outboundFiles[0])
    );

    const contentEntity = await this.getContentEntity(
      this.metadataType,
      fileName
    );

    const containerMemberObject = {
      MetadataContainerId: id,
      FullName: fileName,
      Body: body,
      Metadata: metadataField,
      ...(contentEntity ? { contentEntityId: contentEntity.Id } : {})
    };

    const containerMember = await this.toolingCreate(
      supportedToolingTypes.get(this.metadataType),
      containerMemberObject
    );

    if (!containerMember.success) {
      const deployFailed = new Error();
      deployFailed.message = nls.localize(
        'beta_tapi_membertype_error',
        this.metadataType
      );
      deployFailed.name = this.metadataType.concat('MemberCreationFailed');
      throw deployFailed;
    }
    return containerMember;
  }

  public async getContentEntity(
    metadataType: string,
    fileName: string
  ): Promise<{ Id?: string | unknown }> {
    return (await this.connection.tooling
      .sobject(metadataType)
      .find({ Name: fileName }))[0];
  }

  public async createContainerAsyncRequest(
    container: ToolingCreateResult
  ): Promise<ToolingCreateResult> {
    const contAsyncRequest = await this.toolingCreate(CONTAINER_ASYNC_REQUEST, {
      MetadataContainerId: container.id
    });

    if (!contAsyncRequest.success) {
      const deployFailed = new Error();
      deployFailed.message = nls.localize('beta_tapi_car_error');
      deployFailed.name = 'ContainerAsyncRequestFailed';
      throw deployFailed;
    }
    return contAsyncRequest;
  }

  private sleep(ms: number): Promise<number> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public async toolingStatusCheck(
    asyncRequest: ToolingCreateResult
  ): Promise<ToolingDeployResult> {
    let retrieveResult: ToolingDeployResult = await this.toolingRetrieve(
      CONTAINER_ASYNC_REQUEST,
      asyncRequest.id
    );
    let count = 0;
    while (retrieveResult.State === DeployStatusEnum.Queued && count <= 30) {
      await this.sleep(100);
      retrieveResult = (await this.toolingRetrieve(
        CONTAINER_ASYNC_REQUEST,
        asyncRequest.id
      )) as ToolingDeployResult;
      count++;
    }
    return retrieveResult;
  }

  private async toolingRetrieve(
    type: string,
    id: string
  ): Promise<ToolingDeployResult> {
    return (await this.connection.tooling.retrieve(
      type,
      id
    )) as ToolingDeployResult;
  }
}
