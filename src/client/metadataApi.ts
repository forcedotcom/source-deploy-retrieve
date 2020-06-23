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
import * as util from 'util';
import { nls } from '../i18n';
import { MetadataConverter } from '../convert';

//  * Enum that represents the status of a Metadata Retrieve
//  */
export enum DeployStatusEnum {
  Succeeded = 'Succeeded',
  InProgress = 'InProgress',
  Pending = 'Pending',
  Failed = 'Failed'
}

/* eslint-disable @typescript-eslint/no-unused-vars */
export class MetadataApi extends BaseApi {
  private startTime: [number, number];
  private telemetryMsg: string;
  public async retrieveWithPaths(options: RetrievePathOptions): Promise<ApiResult> {
    throw new Error('Method not implemented.');
  }
  public async retrieve(options: RetrieveOptions): Promise<import('../types').ApiResult> {
    throw new Error('Method not implemented.');
  }

  public async deploy(options: DeployOptions): Promise<DeployResult> {
    const metadataComponents: MetadataComponent[] = options.components;
    const Converter = new MetadataConverter();
    const conversionCall = await Converter.convert(metadataComponents, 'metadata', { type: 'zip' });
    const conversionBuffer = conversionCall.zipBuffer;
    const deployID = await this.metadataDeployID(conversionBuffer);
    const deployResult = await this.metadataDeployStatusPoll(deployID);
    return deployResult;
  }

  public async deployWithPaths(options: DeployPathOptions): Promise<DeployResult> {
    const paths = options.paths[0];
    const components = this.registry.getComponentsFromPath(paths);
    return this.deploy({ components });
  }

  public async metadataDeployID(zipBuffer: Buffer): Promise<string> {
    const deployOpts = {
      rollbackOnError: true,
      ignoreWarnings: false,
      checkOnly: false,
      singlePackage: true
    };
    let deployID = '';

    await this.connection.metadata.deploy(zipBuffer, deployOpts, (err, res) => {
      if (err) {
        throw new Error(err.message);
      }
      deployID = res.id;
    });
    return deployID;
  }
  public async metadataDeployStatusPoll(
    deployID: string,
    timeout?: number,
    interval?: number
  ): Promise<DeployResult> {
    timeout = timeout || 10000;
    interval = interval || 100;

    const endTime = Number(new Date()) + timeout;
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    const checkDeploy = async (resolve, reject) => {
      const result = this.connection.metadata.checkDeployStatus(deployID);

      if (result) {
        let status = '';
        await result.then(res => {
          // @ts-ignore
          status = res.status;
        });
        // test to make sure this works
        switch (status) {
          case DeployStatusEnum.Succeeded:
            resolve(result);
            break;
          case DeployStatusEnum.InProgress:
          case DeployStatusEnum.Pending:
          case '':
            if (Number(new Date()) < endTime) {
              setTimeout(checkDeploy, interval, resolve, reject);
            } else {
              reject(new Error(nls.localize('md_request_timeout')));
            }
            break;
          case DeployStatusEnum.Failed:
            reject(new Error(nls.localize('md_request_fail')));
            break;
          default:
            if (Number(new Date()) < endTime) {
              setTimeout(checkDeploy, interval, resolve, reject);
            } else {
              reject(new Error(nls.localize('md_request_timeout')));
            }
        }
      } else if (Number(new Date()) < endTime) {
        setTimeout(checkDeploy, interval, resolve, reject);
      } else {
        reject(new Error(nls.localize('md_request_timeout')));
      }
    };

    return new Promise(checkDeploy);
  }

  public getEndHRTime(hrstart: [number, number]): string {
    const hrend = process.hrtime(hrstart);
    return util.format('%d%d', hrend[0], hrend[1] / 1000000);
  }
}
