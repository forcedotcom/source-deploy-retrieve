/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection, fs, Logger } from '@salesforce/core';
import { EventEmitter } from 'events';
import { ComponentSet } from '../collections';
import { MetadataTransferError } from '../errors';
import { MetadataRequestStatus, RequestStatus, MetadataTransferResult } from './types';
import { MetadataConverter, SfdxFileFormat } from '../convert';
import { join } from 'path';

export interface MetadataTransferOptions {
  usernameOrConnection: string | Connection;
  components: ComponentSet;
  apiVersion?: string;
  id?: string;
}

export abstract class MetadataTransfer<
  Status extends MetadataRequestStatus,
  Result extends MetadataTransferResult
> {
  protected components: ComponentSet;
  protected logger: Logger;
  protected canceled = false;
  private _id?: string;
  private event = new EventEmitter();
  private usernameOrConnection: string | Connection;
  private apiVersion: string;

  constructor({ usernameOrConnection, components, apiVersion, id }: MetadataTransferOptions) {
    this.usernameOrConnection = usernameOrConnection;
    this.components = components;
    this.apiVersion = apiVersion;
    this._id = id;
    this.logger = Logger.childFromRoot(this.constructor.name);
  }

  get id(): string | undefined {
    return this._id;
  }

  /**
   * Start the metadata transfer.
   *
   * @param pollInterval Frequency in milliseconds to poll for operation status
   */
  public async start(pollInterval = 100): Promise<Result | undefined> {
    try {
      this.canceled = false;
      const { id } = await this.pre();
      this._id = id;
      const apiResult = await this.pollStatus(pollInterval);

      if (!apiResult || apiResult.status === RequestStatus.Canceled) {
        this.event.emit('cancel', apiResult);
        return;
      }

      const sourceResult = await this.post(apiResult);
      this.event.emit('finish', sourceResult);

      return sourceResult;
    } catch (e) {
      if (this.event.listenerCount('error') === 0) {
        throw e;
      }
      this.event.emit('error', e);
    }
  }

  public onUpdate(subscriber: (result: Status) => void): void {
    this.event.on('update', subscriber);
  }

  public onFinish(subscriber: (result: Result) => void): void {
    this.event.on('finish', subscriber);
  }

  public onCancel(subscriber: (result: Status | undefined) => void): void {
    this.event.on('cancel', subscriber);
  }

  public onError(subscriber: (result: Error) => void): void {
    this.event.on('error', subscriber);
  }

  protected async maybeSaveTempDirectory(target: SfdxFileFormat, cs?: ComponentSet): Promise<void> {
    const mdapiTempDir = process.env.SFDX_MDAPI_TEMP_DIR;
    if (mdapiTempDir) {
      process.emitWarning(
        'The SFDX_MDAPI_TEMP_DIR environment variable is set, which may degrade performance'
      );
      this.logger.debug(
        `Converting metadata to: ${mdapiTempDir} because the SFDX_MDAPI_TEMP_DIR environment variable is set`
      );
      try {
        const source = cs || this.components;
        const converter = new MetadataConverter();
        if (target === 'source') {
          await converter.convert(source.getSourceComponents().toArray(), target, {
            type: 'directory',
            outputDirectory: mdapiTempDir,
          });
          // for source convert the package.xml isn't included, we'll write that separately

          fs.writeFileSync(join(mdapiTempDir, 'package.xml'), source.getPackageXml());
        } else {
          await converter.convert(source.getSourceComponents().toArray(), target, {
            type: 'directory',
            outputDirectory: mdapiTempDir,
          });
        }
      } catch (e) {
        this.logger.debug(e);
      }
    }
  }

  protected async getConnection(): Promise<Connection> {
    if (typeof this.usernameOrConnection === 'string') {
      this.usernameOrConnection = await Connection.create({
        authInfo: await AuthInfo.create({ username: this.usernameOrConnection }),
      });
      if (this.apiVersion) {
        this.usernameOrConnection.setApiVersion(this.apiVersion);
        this.logger.debug(`Overriding apiVersion to: ${this.apiVersion}`);
      }
    }
    return this.usernameOrConnection;
  }

  private async pollStatus(interval: number): Promise<Status> {
    let result: Status;
    let triedOnce = false;

    try {
      while (true) {
        if (this.canceled) {
          if (result) {
            result.status = RequestStatus.Canceled;
          }
          return result;
        }

        if (triedOnce) {
          await this.wait(interval);
        }

        result = await this.checkStatus();

        switch (result.status) {
          case RequestStatus.Canceled:
            this.canceled = true;
          case RequestStatus.Succeeded:
          case RequestStatus.Failed:
            return result;
        }

        this.event.emit('update', result);

        triedOnce = true;
      }
    } catch (e) {
      throw new MetadataTransferError('md_request_fail', e.message);
    }
  }

  private wait(interval: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, interval);
    });
  }

  public abstract checkStatus(): Promise<Status>;
  public abstract cancel(): Promise<void>;
  protected abstract pre(): Promise<{ id: string }>;
  protected abstract post(result: Status): Promise<Result>;
}
