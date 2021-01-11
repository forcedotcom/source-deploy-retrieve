/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Connection } from '@salesforce/core';
import { SourceDeployResult, ComponentStatus } from '..';
import { MetadataConverter, SourceComponent } from '../..';
import { DiagnosticUtil } from '../diagnosticUtil';
import {
  DeployResult,
  ComponentDeployment,
  DeployMessage,
  MetadataApiDeployOptions,
} from '../types';
import { MetadataApiOperation } from './metadataApiOperation';

export class DeployOperation extends MetadataApiOperation<DeployResult, SourceDeployResult> {
  public static readonly DEFAULT_OPTIONS = {
    rollbackOnError: true,
    ignoreWarnings: false,
    checkOnly: false,
    singlePackage: true,
  };
  private components: SourceComponent[];
  private options?: MetadataApiDeployOptions;

  constructor(
    connection: Connection,
    components: SourceComponent[],
    options?: MetadataApiDeployOptions
  ) {
    super(connection);
    this.components = components;
    this.options = options || DeployOperation.DEFAULT_OPTIONS;
  }

  protected async doCancel(): Promise<boolean> {
    // @ts-ignore _invoke is private on the jsforce metadata object, and cancelDeploy is not an exposed method
    const { done } = this.connection.metadata._invoke('cancelDeploy', { id: this.id });
    return done;
  }

  protected checkStatus(id: string): Promise<DeployResult> {
    // Recasting to use the project's DeployResult type
    return (this.connection.metadata.checkDeployStatus(id, true) as unknown) as Promise<
      DeployResult
    >;
  }

  protected async pre(): Promise<{ id: string }> {
    const converter = new MetadataConverter();
    const { zipBuffer } = await converter.convert(this.components, 'metadata', { type: 'zip' });

    // if (!options) {
    //   options = DeployOperation.DEFAULT_OPTIONS;
    // } else {
    //   for (const [property, value] of Object.entries(DEFAULT_API_OPTIONS)) {
    //     if (!(property in options.apiOptions)) {
    //       //@ts-ignore ignore while dynamically building the defaults
    //       options.apiOptions[property] = value;
    //     }
    //   }
    // }

    return this.connection.metadata.deploy(zipBuffer, this.options);
  }

  protected async post(result: DeployResult): Promise<SourceDeployResult> {
    const componentDeploymentMap = new Map<string, ComponentDeployment>();
    for (const component of this.components) {
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
