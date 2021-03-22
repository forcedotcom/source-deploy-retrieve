/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { MetadataConverter } from '../convert';
import { DiagnosticUtil } from './diagnosticUtil';
import {
  MetadataApiDeployStatus,
  DeployMessage,
  MetadataApiDeployOptions as ApiOptions,
  ComponentStatus,
  FileResponse,
  MetadataTransferResult,
} from './types';
import { MetadataTransfer, MetadataTransferOptions } from './metadataTransfer';
import { join, dirname, basename, extname } from 'path';
import { SourceComponent, registryData } from '../metadata-registry';
import { ComponentLike } from '../common';
import { normalizeToArray } from '../utils/collections';
import { ComponentSet } from '../collections';

export class DeployResult implements MetadataTransferResult {
  public readonly response: MetadataApiDeployStatus;
  public readonly components: ComponentSet;
  private readonly diagnosticUtil = new DiagnosticUtil('metadata');

  constructor(response: MetadataApiDeployStatus, components: ComponentSet) {
    this.response = response;
    this.components = components;
  }

  public getFileResponses(): FileResponse[] {
    // TODO: Log when messages can't be mapped to components
    const messages = this.getDeployMessages(this.response);
    const fileResponses: FileResponse[] = [];

    for (const deployedComponent of this.components.getSourceComponents()) {
      if (deployedComponent.type.children) {
        for (const child of deployedComponent.getChildren()) {
          const childMessages = messages.get(this.key(child));
          if (childMessages) {
            fileResponses.push(...this.createResponses(child, childMessages));
          }
        }
      }
      const componentMessages = messages.get(this.key(deployedComponent));
      if (componentMessages) {
        fileResponses.push(...this.createResponses(deployedComponent, componentMessages));
      }
    }

    return fileResponses;
  }

  private createResponses(component: SourceComponent, messages: DeployMessage[]): FileResponse[] {
    const { fullName, type, xml, content } = component;
    const responses: FileResponse[] = [];

    for (const message of messages) {
      const baseResponse: Partial<FileResponse> = {
        fullName,
        type: type.name,
        state: this.getState(message),
      };

      if (baseResponse.state === ComponentStatus.Failed) {
        const diagnostic = this.diagnosticUtil.parseDeployDiagnostic(component, message);
        const response = Object.assign(baseResponse, diagnostic) as FileResponse;
        responses.push(response);
      } else {
        // components with children are already taken care of through the messages,
        // so don't walk their content directories.
        if (content && !type.children) {
          for (const filePath of component.walkContent()) {
            const response = Object.assign({}, baseResponse, { filePath }) as FileResponse;
            responses.push(response);
          }
        }

        if (xml) {
          const response = Object.assign({}, baseResponse, { filePath: xml }) as FileResponse;
          responses.push(response);
        }
      }
    }

    return responses;
  }

  private getState(message: DeployMessage): ComponentStatus {
    if (message.created === 'true') {
      return ComponentStatus.Created;
    } else if (message.changed === 'true') {
      return ComponentStatus.Changed;
    } else if (message.deleted === 'true') {
      return ComponentStatus.Deleted;
    } else if (message.success === 'false') {
      return ComponentStatus.Failed;
    }
    return ComponentStatus.Unchanged;
  }

  /**
   * Groups messages from the deploy result by component fullName and type
   */
  private getDeployMessages(result: MetadataApiDeployStatus): Map<string, DeployMessage[]> {
    const messageMap = new Map<string, DeployMessage[]>();

    const failedComponents = new ComponentSet();
    const failureMessages = normalizeToArray(result.details.componentFailures);
    const successMessages = normalizeToArray(result.details.componentSuccesses);

    for (const failure of failureMessages) {
      const sanitized = this.sanitizeDeployMessage(failure);
      const componentLike: ComponentLike = {
        fullName: sanitized.fullName,
        type: sanitized.componentType,
      };
      const key = this.key(componentLike);
      if (!messageMap.has(key)) {
        messageMap.set(key, []);
      }
      messageMap.get(key).push(sanitized);
      failedComponents.add(componentLike);
    }

    for (const success of successMessages) {
      const sanitized = this.sanitizeDeployMessage(success);
      const componentLike: ComponentLike = {
        fullName: sanitized.fullName,
        type: sanitized.componentType,
      };
      const key = this.key(componentLike);
      // this will ensure successes aren't reported if there is a failure for
      // the same component. e.g. lwc returns failures and successes
      if (!failedComponents.has(componentLike)) {
        messageMap.set(key, [sanitized]);
      }
    }

    return messageMap;
  }

  /**
   * Fix any issues with the deploy message returned by the api.
   * TODO: remove cases if fixes are made in the api.
   */
  private sanitizeDeployMessage(message: DeployMessage): DeployMessage {
    switch (message.componentType) {
      case registryData.types.lightningcomponentbundle.name:
        // remove the markup scheme from fullName
        message.fullName = message.fullName.replace(/markup:\/\/c:/, '');
        break;
      case registryData.types.document.name:
        // strip document extension from fullName
        message.fullName = join(
          dirname(message.fullName),
          basename(message.fullName, extname(message.fullName))
        );
        break;
      default:
    }
    return message;
  }

  private key(component: ComponentLike): string {
    const type = typeof component.type === 'string' ? component.type : component.type.name;
    return `${type}#${component.fullName}`;
  }
}

export interface MetadataApiDeployOptions extends MetadataTransferOptions {
  apiOptions?: ApiOptions;
}

export class MetadataApiDeploy extends MetadataTransfer<MetadataApiDeployStatus, DeployResult> {
  public static readonly DEFAULT_OPTIONS: Partial<MetadataApiDeployOptions> = {
    apiOptions: {
      rollbackOnError: true,
      ignoreWarnings: false,
      checkOnly: false,
      singlePackage: true,
    },
  };
  private options: MetadataApiDeployOptions;
  private deployId: string | undefined;

  constructor(options: MetadataApiDeployOptions) {
    super(options);
    options.apiOptions = { ...MetadataApiDeploy.DEFAULT_OPTIONS.apiOptions, ...options.apiOptions };
    this.options = Object.assign({}, options);
  }

  protected async pre(): Promise<{ id: string }> {
    const converter = new MetadataConverter();
    const { zipBuffer } = await converter.convert(
      Array.from(this.components.getSourceComponents()),
      'metadata',
      { type: 'zip' }
    );
    const connection = await this.getConnection();
    const result = await connection.metadata.deploy(zipBuffer, this.options.apiOptions);
    this.deployId = result.id;
    return result;
  }

  protected async checkStatus(id: string): Promise<MetadataApiDeployStatus> {
    const connection = await this.getConnection();
    // Recasting to use the project's version of the type
    return (connection.metadata.checkDeployStatus(id, true) as unknown) as MetadataApiDeployStatus;
  }

  protected async post(result: MetadataApiDeployStatus): Promise<DeployResult> {
    return new DeployResult(result, this.components);
  }

  protected async doCancel(): Promise<boolean> {
    let done = true;
    if (this.deployId) {
      const connection = await this.getConnection();
      // @ts-ignore _invoke is private on the jsforce metadata object, and cancelDeploy is not an exposed method
      done = connection.metadata._invoke('cancelDeploy', { id: this.deployId }).done;
    }
    return done;
  }
}
