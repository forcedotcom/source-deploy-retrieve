/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SourceDeployResult, ComponentStatus } from '..';
import { MetadataConverter } from '../..';
import { DiagnosticUtil } from '../diagnosticUtil';
import {
  DeployResult,
  ComponentDeployment,
  DeployMessage,
  MetadataApiDeployOptions,
} from '../types';
import { MetadataOperation, MetadataOperationOptions } from './metadataOperation';

export type DeployOperationOptions = MetadataOperationOptions & MetadataApiDeployOptions;

export class MetadataApiDeploy extends MetadataOperation<DeployResult, SourceDeployResult> {
  public static readonly DEFAULT_OPTIONS: MetadataApiDeployOptions = {
    rollbackOnError: true,
    ignoreWarnings: false,
    checkOnly: false,
    singlePackage: true,
  };
  private options: MetadataApiDeployOptions;
  private deployId: string | undefined;

  constructor(options: DeployOperationOptions) {
    super(options);
    this.options = Object.assign({}, MetadataApiDeploy.DEFAULT_OPTIONS, options);
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

  protected async checkStatus(id: string): Promise<DeployResult> {
    const connection = await this.getConnection();
    // Recasting to use the project's DeployResult type
    return (connection.metadata.checkDeployStatus(id, true) as unknown) as DeployResult;
  }

  protected async pre(): Promise<{ id: string }> {
    const converter = new MetadataConverter();
    const { zipBuffer } = await converter.convert(
      Array.from(this.components.getSourceComponents()),
      'metadata',
      { type: 'zip' }
    );
    const connection = await this.getConnection();
    const result = await connection.metadata.deploy(zipBuffer, MetadataApiDeploy.DEFAULT_OPTIONS);
    this.deployId = result.id;
    return result;
  }

  protected async post(result: DeployResult): Promise<SourceDeployResult> {
    const componentDeploymentMap = new Map<string, ComponentDeployment>();
    for (const component of this.components.getSourceComponents()) {
      componentDeploymentMap.set(`${component.type.name}:${component.fullName}`, {
        status: ComponentStatus.Unchanged,
        component,
        diagnostics: [],
      });
    }
    const deployResult: SourceDeployResult = {
      id: result.id,
      status: result.status,
      success: result.success,
    };

    const messages = this.getDeployMessages(result);
    const diagnosticUtil = new DiagnosticUtil('metadata');

    if (messages.length > 0) {
      deployResult.components = [];
      for (let message of messages) {
        message = this.sanitizeDeployMessage(message);
        const componentKey = `${message.componentType}:${message.fullName}`;
        const componentDeployment = componentDeploymentMap.get(componentKey);

        if (componentDeployment) {
          if (message.created === 'true') {
            componentDeployment.status = ComponentStatus.Created;
          } else if (message.changed === 'true') {
            componentDeployment.status = ComponentStatus.Changed;
          } else if (message.deleted === 'true') {
            componentDeployment.status = ComponentStatus.Deleted;
          } else if (message.success === 'false') {
            componentDeployment.status = ComponentStatus.Failed;
          } else {
            componentDeployment.status = ComponentStatus.Unchanged;
          }

          if (message.problem) {
            diagnosticUtil.setDeployDiagnostic(componentDeployment, message);
          }
        }
      }
      deployResult.components = Array.from(componentDeploymentMap.values());
    }

    return deployResult;
  }

  private getDeployMessages(result: DeployResult): DeployMessage[] {
    const messages: DeployMessage[] = [];
    if (result.details) {
      const { componentSuccesses, componentFailures } = result.details;
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
    }
    return messages;
  }

  /**
   * Fix any issues with the deploy message returned by the api.
   * TODO: remove as fixes are made in the api.
   */
  private sanitizeDeployMessage(message: DeployMessage): DeployMessage {
    // lwc doesn't properly use the fullname property in the api.
    message.fullName = message.fullName.replace(/markup:\/\/c:/, '');
    return message;
  }
}
