/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  DeployResult,
  BaseApi,
  RetrieveOptions,
  RetrievePathOptions,
  ApiResult,
  MetadataComponent,
  SourcePath
} from '../types';
import { nls } from '../i18n';
import { MetadataConverter } from '../convert';
import { DeployError } from '../errors';
import { MetadataDeployOptions } from '../types/client';

export const enum DeployStatusEnum {
  Succeeded = 'Succeeded',
  InProgress = 'InProgress',
  Pending = 'Pending',
  Failed = 'Failed'
}
export const defaults = {
  rollbackOnError: true,
  ignoreWarnings: false,
  checkOnly: false
};
/* eslint-disable @typescript-eslint/no-unused-vars */
export class MetadataApi extends BaseApi {
  public async retrieveWithPaths(options: RetrievePathOptions): Promise<ApiResult> {
    throw new Error('Method not implemented.');
  }
  public async retrieve(options: RetrieveOptions): Promise<ApiResult> {
    throw new Error('Method not implemented.');
  }

  public async deploy(
    components: MetadataComponent | MetadataComponent[],
    options?: MetadataDeployOptions
  ): Promise<DeployResult> {
    const metadataComponents = Array.isArray(components) ? components : [components];
    const converter = new MetadataConverter();
    const conversionCall = await converter.convert(metadataComponents, 'metadata', { type: 'zip' });
    const deployID = await this.metadataDeployID(conversionCall.zipBuffer, options);
    const deploy = this.metadataDeployStatusPoll(deployID, options);
    let files: string[] = [];
    metadataComponents.forEach(file => {
      files = files.concat(file.sources);
      files.push(file.xml);
    });
    (await deploy).outboundFiles = files;
    return deploy;
  }

  public async deployWithPaths(
    paths: SourcePath,
    options?: MetadataDeployOptions
  ): Promise<DeployResult> {
    const components = this.registry.getComponentsFromPath(paths);
    return this.deploy(components, options);
  }

  public async metadataDeployID(
    zipBuffer: Buffer,
    options?: MetadataDeployOptions
  ): Promise<string> {
    if (!options || !options.apiOptions) {
      options = {
        apiOptions: defaults
      };
    } else {
      for (const [property, value] of Object.entries(defaults)) {
        if (!(property in options.apiOptions)) {
          //@ts-ignore ignore while dynamically building the defaults
          options.apiOptions[property] = value;
        }
      }
    }
    const result = await this.connection.metadata.deploy(zipBuffer, options.apiOptions);
    return result.id;
  }
  public async metadataDeployStatusPoll(
    deployID: string,
    options: MetadataDeployOptions,
    interval = 100
  ): Promise<DeployResult> {
    const timeout = !options || !options.wait ? 10000 : options.wait;
    const endTime = Date.now() + timeout;
    // @ts-ignore
    const checkDeploy = async (resolve, reject): Promise<DeployResult> => {
      const result = await this.connection.metadata.checkDeployStatus(deployID);

      switch (result.status) {
        case DeployStatusEnum.Succeeded:
          resolve(result);
          break;
        case DeployStatusEnum.Failed:
          const deployError = new DeployError('md_request_fail', result.errorMessage);
          reject(deployError);
          break;
        case DeployStatusEnum.InProgress:
        case DeployStatusEnum.Pending:
        case '':
        default:
          if (Date.now() < endTime) {
            setTimeout(checkDeploy, interval, resolve, reject);
          } else {
            reject(new Error(nls.localize('md_request_timeout')));
          }
      }
    };

    return new Promise(checkDeploy);
  }
}
