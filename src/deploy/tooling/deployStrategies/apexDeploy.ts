/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import * as path from 'path';
import { BaseDeploy } from './baseDeploy';
import { nls } from '../../../i18n';
import {
  DeployStatusEnum,
  supportedToolingTypes,
  ToolingCreateResult,
  ToolingDeployResult
} from './index';
import { MetadataComponent } from '../../../metadata-registry/index';
const CONTAINER_ASYNC_REQUEST = 'ContainerAsyncRequest';
const METADATA_CONTAINER = 'MetadataContainer';

export class ApexDeploy extends BaseDeploy {
  public async deploy(
    component: MetadataComponent
  ): Promise<ToolingDeployResult> {
    this.metadataType = component.type.name;
    const sourcePath = component.sources[0];
    const metadataPath = component.xml;

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
