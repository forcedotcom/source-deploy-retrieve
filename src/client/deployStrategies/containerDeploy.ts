/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { readFileSync } from 'fs';
import { deployTypes } from '../toolingApi';
import { DeployError } from '../../errors';
import { MetadataComponent, DeployStatusEnum, DeployResult, QueryResult } from '../../types';
import { baseName } from '../../utils/path';
import { ToolingCreateResult } from '../../utils/deploy';
import { CONTAINER_ASYNC_REQUEST, METADATA_CONTAINER } from './constants';
import { BaseDeploy } from './baseDeploy';

export class ContainerDeploy extends BaseDeploy {
  public async deploy(component: MetadataComponent, namespace: string): Promise<DeployResult> {
    this.component = component;
    this.namespace = namespace;
    const sourcePath = component.sources[0];
    const metadataPath = component.xml;

    const container = await this.createMetadataContainer();
    await this.createContainerMember([sourcePath, metadataPath], container);
    const asyncRequest = await this.createContainerAsyncRequest(container);
    const output = await this.toolingStatusCheck(asyncRequest);
    return output;
  }

  public async createMetadataContainer(): Promise<ToolingCreateResult> {
    const metadataContainer = await this.toolingCreate(METADATA_CONTAINER, {
      Name: `Deploy_MDC_${Date.now()}`
    });

    if (!metadataContainer.success) {
      throw new DeployError('beta_tapi_mdcontainer_error');
    }
    return metadataContainer;
  }

  public async createContainerMember(
    outboundFiles: string[],
    container: ToolingCreateResult
  ): Promise<ToolingCreateResult> {
    const id = container.id;
    const metadataContent = readFileSync(outboundFiles[1], 'utf8');
    const metadataField = this.buildMetadataField(metadataContent);
    const body = readFileSync(outboundFiles[0], 'utf8');
    const fileName = baseName(outboundFiles[0]);

    const entityId = await this.getContentEntity(
      this.component.type.name,
      fileName,
      this.namespace
    );

    const containerMemberObject = {
      MetadataContainerId: id,
      FullName: fileName,
      Body: body,
      Metadata: metadataField,
      ...(entityId ? { contentEntityId: entityId } : {})
    };

    const containerMember = await this.toolingCreate(
      deployTypes.get(this.component.type.name),
      containerMemberObject
    );

    if (!containerMember.success) {
      throw new DeployError('beta_tapi_membertype_error', this.component.type.name);
    }
    return containerMember;
  }

  public async getContentEntity(
    metadataType: string,
    fileName: string,
    namespace: string
  ): Promise<string | undefined> {
    const queryResult = (await this.connection.tooling.query(
      `Select Id from ${metadataType} where Name = '${fileName}' and NamespacePrefix = '${namespace}'`
    )) as QueryResult;

    return queryResult && queryResult.records.length === 1 ? queryResult.records[0].Id : undefined;
  }

  public async createContainerAsyncRequest(
    container: ToolingCreateResult
  ): Promise<ToolingCreateResult> {
    const contAsyncRequest = await this.toolingCreate(CONTAINER_ASYNC_REQUEST, {
      MetadataContainerId: container.id
    });

    if (!contAsyncRequest.success) {
      throw new DeployError('beta_tapi_car_error');
    }
    return contAsyncRequest;
  }

  private sleep(ms: number): Promise<number> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public async toolingStatusCheck(asyncRequest: ToolingCreateResult): Promise<DeployResult> {
    let retrieveResult: DeployResult = await this.toolingRetrieve(
      CONTAINER_ASYNC_REQUEST,
      asyncRequest.id
    );
    let count = 0;
    while (retrieveResult.State === DeployStatusEnum.Queued && count <= 30) {
      await this.sleep(100);
      retrieveResult = await this.toolingRetrieve(CONTAINER_ASYNC_REQUEST, asyncRequest.id);
      count++;
    }
    retrieveResult.metadataFile = this.component.xml;
    retrieveResult.outboundFiles = this.component.sources;
    retrieveResult.outboundFiles.push(this.component.xml);
    return retrieveResult;
  }

  private async toolingRetrieve(type: string, id: string): Promise<DeployResult> {
    return (await this.connection.tooling.retrieve(type, id)) as DeployResult;
  }
}
