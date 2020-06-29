/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  DeployOptions,
  DeployResult,
  BaseApi,
  RetrieveOptions,
  RetrievePathOptions,
  ApiResult,
  DeployPathOptions,
  MetadataComponent
} from '../types';
import { nls } from '../i18n';
import { MetadataConverter } from '../convert';

export const enum DeployStatusEnum {
  Succeeded = 'Succeeded',
  InProgress = 'InProgress',
  Pending = 'Pending',
  Failed = 'Failed'
}

/* eslint-disable @typescript-eslint/no-unused-vars */
export class MetadataApi extends BaseApi {
  public async retrieveWithPaths(options: RetrievePathOptions): Promise<ApiResult> {
    throw new Error('Method not implemented.');
  }
  public async retrieve(options: RetrieveOptions): Promise<import('../types').ApiResult> {
    throw new Error('Method not implemented.');
  }

  public async deploy(options: DeployOptions): Promise<DeployResult> {
    const metadataComponents: MetadataComponent[] = options.components;
    const converter = new MetadataConverter();
    const conversionCall = await converter.convert(metadataComponents, 'metadata', { type: 'zip' });
    const conversionBuffer = conversionCall.zipBuffer;
    const deployID = await this.metadataDeployID(conversionBuffer);
    return this.metadataDeployStatusPoll(deployID, options.wait);
  }

  public async deployWithPaths(options: DeployPathOptions): Promise<DeployResult> {
    const paths = options.paths[0];
    const components = this.registry.getComponentsFromPath(paths);
    return this.deploy({ components, wait: options.wait });
  }

  public async metadataDeployID(zipBuffer: Buffer): Promise<string> {
    const deployOpts = {
      rollbackOnError: true,
      ignoreWarnings: false,
      checkOnly: false,
      singlePackage: true
    };
    const result = await this.connection.metadata.deploy(zipBuffer, deployOpts);
    return result.id;
  }
  public async metadataDeployStatusPoll(
    deployID: string,
    timeout?: number,
    interval?: number
  ): Promise<DeployResult> {
    timeout = timeout || 10000;
    interval = interval || 100;

    const endTime = Date.now() + timeout;
    const checkDeploy = async (resolve, reject): Promise<DeployResult> => {
      const result = await this.connection.metadata.checkDeployStatus(deployID);

      switch (result.status) {
        case DeployStatusEnum.Succeeded:
          resolve(result);
          break;
        case DeployStatusEnum.Failed:
          reject(new Error(nls.localize('md_request_fail')));
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
