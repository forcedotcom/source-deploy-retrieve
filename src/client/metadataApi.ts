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
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import * as admzip from 'adm-zip';
import { ManifestGenerator } from '../metadata-registry';
import { nls } from '../i18n';
import * as archiver from 'archiver';
/*
export type DeployOptions = {
  rollbackOnError?: boolean;
  testLevel?: string;
  runTests?: string;
  autoUpdatePackage?: boolean;
  ignoreWarnings?: boolean;
  checkOnly?: boolean;
  singlePackage?: boolean;
};
*/
/**
 * Enum that represents the status of a Metadata Retrieve
 */
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
  public async retrieveWithPaths(
    options: RetrievePathOptions
  ): Promise<ApiResult> {
    throw new Error('Method not implemented.');
  }
  public async retrieve(
    options: RetrieveOptions
  ): Promise<import('../types').ApiResult> {
    throw new Error('Method not implemented.');
  }
  public async deployWithPaths(
    options: DeployPathOptions
  ): Promise<DeployResult> {
    this.startTime = process.hrtime();
    const deployPaths = options.paths[0];
    const regStart = process.hrtime();
    const registryCmps = this.registry.getComponentsFromPath(deployPaths);
    const regEnd = this.getEndHRTime(regStart);
    this.telemetryMsg = `Registry operation took ${regEnd} milliseconds\n`;
    console.log(`Registry operation took ${regEnd} milliseconds`);
    return await this.deployStreams({
      components: registryCmps
    });
  }
  public async deploy(options: DeployOptions): Promise<DeployResult> {
    const mdComponents: MetadataComponent[] = options.components;
    // this is for test purposes only
    const projectRoot = options.components[0].xml.split('force-app')[0];
    const zipPath = path.join(projectRoot, '.sfdx', 'deploy', 'deployZip.zip');

    const zipStart = process.hrtime();
    // creating archives
    const zip = new admzip();
    // add manifest file directly to zip
    const manifestGenerator = new ManifestGenerator();
    const manifestContent = manifestGenerator.createManifest(mdComponents);
    zip.addFile(
      'package.xml',
      Buffer.alloc(manifestContent.length, manifestContent),
      manifestContent
    );

    // Here's where we need to consume the results from source conversion
    mdComponents.forEach(mdc => {
      zip.addLocalFile(mdc.sources[0], mdc.type.directoryName);
      zip.addLocalFile(mdc.xml, mdc.type.directoryName);
    });
    // create zip file and save it on disk
    // we should move to use streams since that is more performant, specially for big projects
    zip.writeZip(zipPath);

    const deployID = await this.metadataDeployID(zipPath);
    const zipEnd = this.getEndHRTime(zipStart);
    const deployEnd = this.getEndHRTime(this.startTime);
    console.log(`Zip file creation and queueing took ${zipEnd} milliseconds`);
    console.log(`Total deploy operation ${deployEnd} milliseconds`);
    this.telemetryMsg += `Zip file creation and queueing took ${zipEnd} milliseconds\n`;
    this.telemetryMsg += `Total deploy operation ${deployEnd} milliseconds`;
    const deployResult = await this.metadataDeployStatusPoll(deployID);
    deployResult.ErrorMsg = this.telemetryMsg;
    return deployResult;
  }

  public async deployStreams(options: DeployOptions): Promise<DeployResult> {
    const mdComponents: MetadataComponent[] = options.components;
    // this is for test purposes only
    const projectRoot = options.components[0].xml.split('force-app')[0];
    const zipPath = path.join(projectRoot, '.sfdx', 'deploy', 'deployZip.zip');

    const zipStart = process.hrtime();

    const output = await this.createZipStream(zipPath, mdComponents);
    const deployOpts = {
      rollbackOnError: true,
      ignoreWarnings: false,
      checkOnly: false,
      singlePackage: true
    };
    let deployID = '';
    // const zipStream = fs.createReadStream(zipPath);
    await this.connection.metadata.deploy(output, deployOpts, (err, res) => {
      if (err) {
        throw new Error(err.message);
      }
      deployID = res.id;
    });

    const zipEnd = this.getEndHRTime(zipStart);
    const deployEnd = this.getEndHRTime(this.startTime);
    console.log(`Zip file creation and queueing took ${zipEnd} milliseconds`);
    console.log(`Total deploy operation ${deployEnd} milliseconds`);
    this.telemetryMsg += `Zip file creation and queueing took ${zipEnd} milliseconds\n`;
    this.telemetryMsg += `Total deploy operation ${deployEnd} milliseconds`;
    const deployResult = await this.metadataDeployStatusPoll(deployID);
    deployResult.ErrorMsg = this.telemetryMsg;
    return deployResult;
  }

  public async createZipStream(
    zipPath: string,
    mdComponents: MetadataComponent[]
  ): Promise<fs.WriteStream> {
    const output = fs.createWriteStream(zipPath); // new fs.WriteStream();

    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    const createZip = async (resolve, reject) => {
      // creating archives
      const zip = archiver('zip');
      // add manifest file directly to zip
      const manifestGenerator = new ManifestGenerator();
      const manifestContent = manifestGenerator.createManifest(mdComponents);
      zip.append(manifestContent, { name: 'package.xml' });

      // Here's where we need to consume the results from source conversion
      mdComponents.forEach(mdc => {
        const file = fs.createReadStream(mdc.sources[0]);
        zip.append(file, {
          name: path.join(
            mdc.type.directoryName,
            `${mdc.fullName}.${mdc.type.suffix}`
          )
        });
        const xmlfile = fs.createReadStream(mdc.xml);
        zip.append(xmlfile, {
          name: path.join(
            mdc.type.directoryName,
            `${mdc.fullName}.${mdc.type.suffix}-meta.xml`
          )
        });
      });
      zip.on('end', () => {
        resolve(output);
      });
      zip.finalize();
      zip.pipe(output);
    };

    return new Promise(createZip);
  }

  public async metadataDeployID(zipPath: string): Promise<string> {
    const zipStream = fs.createReadStream(zipPath);
    const deployOpts = {
      rollbackOnError: true,
      ignoreWarnings: false,
      checkOnly: false,
      singlePackage: true
    };
    let deployID = '';
    await this.connection.metadata.deploy(zipStream, deployOpts, (err, res) => {
      if (err) {
        throw new Error(err.message);
      }
      deployID = res.id;
    });
    return deployID;
  }

  /**
   * This allows us to wrap async functions, like metadata retrieve, so we can
   * execute them as Immediately Invoked Function Expression in order to poll
   * for its results
   * @param retrieveID metadata retrieve Id
   * @param timeout period of time in milliseconds before finish polling
   * @param interval time interval between polls in milliseconds
   */
  public async metadataDeployStatusPoll(
    deployID: string,
    timeout?: number,
    interval?: number
  ): Promise<DeployResult> {
    timeout = timeout || 2000;
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
