/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { readFileSync } from 'fs';
import { deployTypes } from '../toolingApi';
import { DeployError } from '../../errors';
import {
  QueryResult,
  SourceDeployResult,
  ContainerAsyncRequest,
  ToolingDeployStatus,
  RecordId,
  ComponentDeployment,
  ComponentStatus,
} from '../types';
import { baseName } from '../../utils/path';
import { ToolingCreateResult } from '../../utils/deploy';
import { BaseDeploy } from './baseDeploy';
import { SourceComponent } from '../../metadata-registry';

export class ContainerDeploy extends BaseDeploy {
  private static readonly CONTAINER_ASYNC_REQUEST = 'ContainerAsyncRequest';
  private static readonly METADATA_CONTAINER = 'MetadataContainer';

  public async deploy(component: SourceComponent, namespace: string): Promise<SourceDeployResult> {
    this.component = component;
    this.namespace = namespace;
    const sourcePath = component.content;
    const metadataPath = component.xml;

    const container = await this.createMetadataContainer();
    await this.createContainerMember([sourcePath, metadataPath], container);
    const asyncRequest = await this.createContainerAsyncRequest(container);
    const containerRequestStatus = await this.pollContainerStatus(asyncRequest.id);
    return this.buildSourceDeployResult(containerRequestStatus);
  }

  public async createMetadataContainer(): Promise<ToolingCreateResult> {
    const metadataContainer = await this.toolingCreate(ContainerDeploy.METADATA_CONTAINER, {
      Name: `Deploy_MDC_${Date.now()}`,
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
      ...(entityId ? { contentEntityId: entityId } : {}),
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
    const contAsyncRequest = await this.toolingCreate(ContainerDeploy.CONTAINER_ASYNC_REQUEST, {
      MetadataContainerId: container.id,
    });

    if (!contAsyncRequest.success) {
      throw new DeployError('beta_tapi_car_error');
    }
    return contAsyncRequest;
  }

  public async pollContainerStatus(containerId: RecordId): Promise<ContainerAsyncRequest> {
    let count = 0;
    let containerStatus;
    do {
      if (count > 0) {
        await this.sleep(100);
      }
      containerStatus = (await this.connection.tooling.retrieve(
        ContainerDeploy.CONTAINER_ASYNC_REQUEST,
        containerId
      )) as ContainerAsyncRequest;
      count++;
    } while (containerStatus.State === ToolingDeployStatus.Queued && count <= 30);
    return containerStatus;
  }

  private sleep(ms: number): Promise<number> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private buildSourceDeployResult(containerRequest: ContainerAsyncRequest): SourceDeployResult {
    const componentDeployment: ComponentDeployment = {
      component: this.component,
      status: ComponentStatus.Unchanged,
      diagnostics: [],
    };

    const messages = [];
    const { componentSuccesses, componentFailures } = containerRequest.DeployDetails;
    if (componentSuccesses) {
      if (Array.isArray(componentSuccesses)) {
        messages.push(...componentSuccesses);
      } else {
        messages.push(componentSuccesses);
      }
    }
    if (componentFailures) {
      if (Array.isArray(componentFailures)) {
        messages.push(...componentFailures);
      } else {
        messages.push(componentFailures);
      }
    }

    for (const message of messages) {
      if (message.changed) {
        componentDeployment.status = ComponentStatus.Changed;
      } else if (message.created) {
        componentDeployment.status = ComponentStatus.Created;
      } else if (message.deleted) {
        componentDeployment.status = ComponentStatus.Deleted;
      } else if (!message.success) {
        componentDeployment.status = ComponentStatus.Failed;
        componentDeployment.diagnostics.push({
          error: message.problem,
          problemType: message.problemType,
          filePath: this.component.content,
          lineNumber: Number(message.lineNumber),
          columnNumber: Number(message.columnNumber),
        });
      }
    }

    return {
      id: containerRequest.Id,
      status: containerRequest.State,
      success: containerRequest.State === ToolingDeployStatus.Completed,
      components: [componentDeployment],
    };
  }
}
