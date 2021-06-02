/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection, fs, Logger, PollingClient, StatusResult } from '@salesforce/core';
import { EventEmitter } from 'events';
import { ComponentSet } from '../collections';
import { MetadataTransferError } from '../errors';
import {
  AsyncResult,
  MetadataRequestStatus,
  RequestStatus,
  MetadataTransferResult,
  RecordId,
} from './types';
import { MetadataConverter, SfdxFileFormat } from '../convert';
import { join } from 'path';
import { Duration } from '@salesforce/kit';
import { AnyJson, isNumber } from '@salesforce/ts-types';

export interface MetadataTransferOptions {
  usernameOrConnection: string | Connection;
  components: ComponentSet;
  apiVersion?: string;
}

export abstract class MetadataTransfer<
  Status extends MetadataRequestStatus,
  Result extends MetadataTransferResult
> {
  protected components: ComponentSet;
  protected logger: Logger;
  private signalCancel = false;
  private event = new EventEmitter();
  private usernameOrConnection: string | Connection;
  private apiVersion: string;
  private id: RecordId;

  constructor({ usernameOrConnection, components, apiVersion }: MetadataTransferOptions) {
    this.usernameOrConnection = usernameOrConnection;
    this.components = components;
    this.apiVersion = apiVersion;
    this.logger = Logger.childFromRoot(this.constructor.name);
  }

  public getId(): RecordId {
    return this.id;
  }

  /**
   * Send the metadata transfer request to the org.
   *
   * @returns AsyncResult from the deploy or retrieve response.
   */
  public async start(): Promise<AsyncResult> {
    const asyncResult = await this.pre();
    this.id = asyncResult.id;
    this.logger.debug(`Started metadata transfer. ID = ${this.id}`);
    return asyncResult;
  }

  /**
   * Poll for the status of the metadata transfer request.
   * Default frequency is 100 ms.
   * Default timeout is 60 minutes.
   *
   * @param options Polling options; frequency, timeout, polling function.
   * @returns The result of the deploy or retrieve.
   */
  public async pollStatus(options?: Partial<PollingClient.Options>): Promise<Result>;
  /**
   * Poll for the status of the metadata transfer request.
   * Default frequency is 100 ms.
   * Default timeout is 60 minutes.
   *
   * @param frequency Polling frequency in milliseconds.
   * @param timeout Polling timeout in seconds.
   * @returns The result of the deploy or retrieve.
   */
  public async pollStatus(frequency?: number, timeout?: number): Promise<Result>;
  public async pollStatus(
    frequencyOrOptions?: number | Partial<PollingClient.Options>,
    timeout?: number
  ): Promise<Result> {
    let pollingOptions: PollingClient.Options = {
      frequency: Duration.milliseconds(100),
      timeout: Duration.minutes(60),
      poll: this.poll.bind(this),
    };
    if (isNumber(frequencyOrOptions)) {
      pollingOptions.frequency = Duration.milliseconds(frequencyOrOptions);
    } else if (frequencyOrOptions !== undefined) {
      pollingOptions = { ...pollingOptions, ...frequencyOrOptions };
    }
    if (isNumber(timeout)) {
      pollingOptions.timeout = Duration.seconds(timeout);
    }

    const pollingClient = await PollingClient.create(pollingOptions);

    try {
      this.logger.debug(`Polling for metadata transfer status. ID = ${this.id}`);
      this.logger.debug(`Polling frequency (ms): ${pollingOptions.frequency.milliseconds}`);
      this.logger.debug(`Polling timeout (min): ${pollingOptions.timeout.minutes}`);
      const completedMdapiStatus = ((await pollingClient.subscribe()) as unknown) as Status;
      const result = await this.post(completedMdapiStatus);
      if (completedMdapiStatus.status === RequestStatus.Canceled) {
        this.event.emit('cancel', completedMdapiStatus);
      } else {
        this.event.emit('finish', result);
      }
      return result;
    } catch (e) {
      const error = new MetadataTransferError('md_request_fail', e.message);
      if (this.event.listenerCount('error') === 0) {
        throw error;
      }
      this.event.emit('error', error);
    }
  }

  public cancel(): void {
    this.signalCancel = true;
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

  private async poll(): Promise<StatusResult> {
    let completed = false;
    let mdapiStatus: Status;

    if (this.signalCancel) {
      const shouldBreak = await this.doCancel();
      if (shouldBreak) {
        if (!mdapiStatus) {
          mdapiStatus = { id: this.id, success: false, done: true } as Status;
        }
        mdapiStatus.status = RequestStatus.Canceled;
        completed = true;
      }
      this.signalCancel = false;
    } else {
      mdapiStatus = await this.checkStatus(this.id);
      completed = mdapiStatus?.done;
      if (!completed) {
        this.event.emit('update', mdapiStatus);
      }
    }
    this.logger.debug(`MDAPI status update: ${mdapiStatus.status}`);

    return { completed, payload: (mdapiStatus as unknown) as AnyJson };
  }

  protected abstract pre(): Promise<AsyncResult>;
  protected abstract checkStatus(id: string): Promise<Status>;
  protected abstract post(result: Status): Promise<Result>;
  protected abstract doCancel(): Promise<boolean>;
}
