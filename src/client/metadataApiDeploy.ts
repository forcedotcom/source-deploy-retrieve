/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { MetadataConverter } from '../convert';
import { DiagnosticUtil } from './diagnosticUtil';
import {
  AsyncResult,
  ComponentStatus,
  DeployMessage,
  FileResponse,
  MetadataApiDeployOptions as ApiOptions,
  MetadataApiDeployStatus,
  MetadataTransferResult,
} from './types';
import { MetadataTransfer, MetadataTransferOptions } from './metadataTransfer';
import { basename, dirname, extname, join } from 'path';
import { ComponentLike, SourceComponent } from '../resolve';
import { normalizeToArray } from '../utils';
import { ComponentSet } from '../collections';
import { registry } from '../registry';
import { isString } from '@salesforce/ts-types';
import { MissingJobIdError } from '../errors';

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
      case registry.types.lightningcomponentbundle.name:
        // remove the markup scheme from fullName
        message.fullName = message.fullName.replace(/markup:\/\/c:/, '');
        break;
      case registry.types.document.name:
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
      rest: false,
    },
  };
  private options: MetadataApiDeployOptions;

  constructor(options: MetadataApiDeployOptions) {
    super(options);
    options.apiOptions = { ...MetadataApiDeploy.DEFAULT_OPTIONS.apiOptions, ...options.apiOptions };
    this.options = Object.assign({}, options);
  }

  /**
   * Deploy recently validated components without running Apex tests. Requires the operation to have been
   * created with the `{ checkOnly: true }` API option.
   *
   * Ensure that the following requirements are met before deploying a recent validation:
   * - The components have been validated successfully for the target environment within the last 10 days.
   * - As part of the validation, Apex tests in the target org have passed.
   * - Code coverage requirements are met.
   *   - If all tests in the org or all local tests are run, overall code coverage is at least 75%, and Apex triggers have some coverage.
   *   - If specific tests are run with the RunSpecifiedTests test level, each class and trigger that was deployed is covered by at least 75% individually.
   *
   * See [deployRecentValidation()](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_deployRecentValidation.htm)
   *
   * @param rest - Set to `true` to use the REST API, otherwise defaults to using SOAP
   * @returns The ID of the quick deployment
   */
  public async deployRecentValidation(rest = false): Promise<string> {
    if (!this.id) {
      throw new MissingJobIdError('deploy');
    }
    const conn = await this.getConnection();
    const response = ((await conn.deployRecentValidation({
      id: this.id,
      rest,
    })) as unknown) as AsyncResult | string;
    return isString(response) ? response : (response as AsyncResult).id;
  }

  /**
   * Check the status of the deploy operation.
   *
   * @returns Status of the deploy
   */
  public async checkStatus(): Promise<MetadataApiDeployStatus> {
    if (!this.id) {
      throw new MissingJobIdError('deploy');
    }
    const connection = await this.getConnection();
    // Recasting to use the project's version of the type
    return (connection.metadata.checkDeployStatus(
      this.id,
      true
    ) as unknown) as MetadataApiDeployStatus;
  }

  /**
   * Cancel the deploy operation.
   *
   * Deploys are asynchronously canceled. Once the cancel request is made to the org,
   * check the status of the cancellation with `checkStatus`.
   */
  public async cancel(): Promise<void> {
    if (!this.id) {
      throw new MissingJobIdError('deploy');
    }

    const connection = await this.getConnection();

    return new Promise((resolve, reject) => {
      connection.metadata
        // @ts-ignore _invoke is private on the jsforce metadata object, and cancelDeploy is not an exposed method
        ._invoke('cancelDeploy', { id: this.id })
        .thenCall((result: any) => {
          // this does not return CancelDeployResult as documented in the API.
          // a null result seems to indicate the request was successful
          if (result) {
            reject(result);
          } else {
            resolve(result);
          }
        });
    });
  }

  protected async pre(): Promise<AsyncResult> {
    const converter = new MetadataConverter();
    const { zipBuffer } = await converter.convert(this.components, 'metadata', { type: 'zip' });
    const connection = await this.getConnection();
    await this.maybeSaveTempDirectory('metadata');
    return connection.deploy(zipBuffer, this.options.apiOptions);
  }

  protected async post(result: MetadataApiDeployStatus): Promise<DeployResult> {
    return new DeployResult(result, this.components);
  }
}
