/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { EventEmitter } from 'events';
import { join } from 'path';
import {
  AuthInfo,
  Connection,
  Lifecycle,
  Logger,
  Messages,
  PollingClient,
  SfError,
  StatusResult,
} from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import { AnyJson, isNumber } from '@salesforce/ts-types';
import * as fs from 'graceful-fs';
import { MetadataConverter, SfdxFileFormat } from '../convert';
import { ComponentSet } from '../collections';
import { AsyncResult, MetadataRequestStatus, MetadataTransferResult, RequestStatus } from './types';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.load('@salesforce/source-deploy-retrieve', 'sdr', ['md_request_fail']);

export interface MetadataTransferOptions {
  usernameOrConnection: string | Connection;
  components?: ComponentSet;
  apiVersion?: string;
  id?: string;
}

export abstract class MetadataTransfer<Status extends MetadataRequestStatus, Result extends MetadataTransferResult> {
  protected components: ComponentSet;
  protected logger: Logger;
  protected canceled = false;
  private transferId?: string;
  private event = new EventEmitter();
  private usernameOrConnection: string | Connection;
  private apiVersion: string;

  public constructor({ usernameOrConnection, components, apiVersion, id }: MetadataTransferOptions) {
    this.usernameOrConnection = usernameOrConnection;
    this.components = components;
    this.apiVersion = apiVersion;
    this.transferId = id;
    this.logger = Logger.childFromRoot(this.constructor.name);
  }

  public get id(): string | undefined {
    return this.transferId;
  }

  /**
   * Send the metadata transfer request to the org.
   *
   * @returns AsyncResult from the deploy or retrieve response.
   */
  public async start(): Promise<AsyncResult> {
    this.canceled = false;
    const asyncResult = await this.pre();
    this.transferId = asyncResult.id;
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
   * Default frequency is based on the number of SourceComponents, n, in the transfer, it ranges from 100ms -> n
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
      frequency: Duration.milliseconds(this.calculatePollingFrequency()),
      timeout: Duration.minutes(60),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
    // from the overloaded methods, there's a possibility frequency/timeout isn't set
    // guarantee frequency and timeout are set
    pollingOptions.frequency ??= Duration.milliseconds(this.calculatePollingFrequency());
    pollingOptions.timeout ??= Duration.minutes(60);

    const pollingClient = await PollingClient.create(pollingOptions);

    try {
      this.logger.debug(`Polling for metadata transfer status. ID = ${this.id}`);
      this.logger.debug(`Polling frequency (ms): ${pollingOptions.frequency.milliseconds}`);
      this.logger.debug(`Polling timeout (min): ${pollingOptions.timeout.minutes}`);
      const completedMdapiStatus = (await pollingClient.subscribe()) as unknown as Status;
      const result = await this.post(completedMdapiStatus);
      if (completedMdapiStatus.status === RequestStatus.Canceled) {
        this.event.emit('cancel', completedMdapiStatus);
      } else {
        this.event.emit('finish', result);
      }
      return result;
    } catch (e) {
      const err = e as Error;
      const error = new SfError(messages.getMessage('md_request_fail', [err.message]), 'MetadataTransferError');
      error.setData({
        id: this.id,
      });
      if (error.stack && err.stack) {
        // append the original stack to this new error
        error.stack += `\nDUE TO:\n${err.stack}`;
      }
      if (this.event.listenerCount('error') === 0) {
        throw error;
      }
      this.event.emit('error', error);
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
      await Lifecycle.getInstance().emitWarning(
        'The SFDX_MDAPI_TEMP_DIR environment variable is set, which may degrade performance'
      );
      this.logger.debug(
        `Converting metadata to: ${mdapiTempDir} because the SFDX_MDAPI_TEMP_DIR environment variable is set`
      );
      try {
        const source = cs || this.components || new ComponentSet();
        const converter = new MetadataConverter();
        await converter.convert(source, target, {
          type: 'directory',
          outputDirectory: mdapiTempDir,
        });
        if (target === 'source') {
          // for source convert the package.xml isn't included so write it separately
          await fs.promises.writeFile(join(mdapiTempDir, 'package.xml'), await source.getPackageXml());
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
      if (this.apiVersion && this.apiVersion !== this.usernameOrConnection.version) {
        this.usernameOrConnection.setApiVersion(this.apiVersion);
        this.logger.debug(`Overriding apiVersion to: ${this.apiVersion}`);
      }
    }
    return getConnectionNoHigherThanOrgAllows(this.usernameOrConnection, this.apiVersion);
  }

  private async poll(): Promise<StatusResult> {
    let completed = false;
    let mdapiStatus: Status;

    if (this.canceled) {
      // This only happens for a canceled retrieve. Canceled deploys are
      // handled via checkStatus response.
      if (!mdapiStatus) {
        mdapiStatus = { id: this.id, success: false, done: true } as Status;
      }
      mdapiStatus.status = RequestStatus.Canceled;
      completed = true;
      this.canceled = false;
    } else {
      try {
        mdapiStatus = await this.checkStatus();
        completed = mdapiStatus?.done;
        if (!completed) {
          this.event.emit('update', mdapiStatus);
        }
      } catch (e) {
        this.logger.error(e);
        // tolerate a known mdapi problem 500/INVALID_CROSS_REFERENCE_KEY: invalid cross reference id
        // that happens when request moves out of Pending
        if (e instanceof Error && e.name === 'JsonParseError') {
          this.logger.debug('Metadata API response not parseable', e);
          await Lifecycle.getInstance().emitWarning('Metadata API response not parseable');
          return { completed: false };
        }
        // tolerate intermittent network errors upto retry limit
        if (
          [
            'ETIMEDOUT',
            'ENOTFOUND',
            'ECONNRESET',
            'socket hang up',
            'INVALID_QUERY_LOCATOR',
            '<h1>Bad Message 400</h1><pre>reason: Bad Request</pre>',
          ].some((retryableNetworkError) => (e as Error).message.includes(retryableNetworkError))
        ) {
          this.logger.debug('Network error on the request', e);
          await Lifecycle.getInstance().emitWarning('Network error occurred.  Continuing to poll.');
          return { completed: false };
        }
        throw e;
      }
    }
    this.logger.debug(`MDAPI status update: ${mdapiStatus.status}`);

    return { completed, payload: mdapiStatus as unknown as AnyJson };
  }

  /**
   * Based on the source components in the component set, it will return a polling frequency in milliseconds
   */
  private calculatePollingFrequency(): number {
    const size = this.components?.getSourceComponents().toArray().length || 0;
    // take a piece-wise approach to encapsulate discrete deployment sizes in polling frequencies that "feel" good when deployed
    if (size === 0) {
      // no component set size is possible for retrieve
      return 1000;
    } else if (size <= 10) {
      return 100;
    } else if (size <= 50) {
      return 250;
    } else if (size <= 100) {
      return 500;
    } else if (size <= 1000) {
      return 1000;
    } else {
      return size;
    }
  }

  public abstract checkStatus(): Promise<Status>;
  public abstract cancel(): Promise<void>;
  protected abstract pre(): Promise<AsyncResult>;
  protected abstract post(result: Status): Promise<Result>;
}

/* prevent requests on apiVersions higher than the org supports */
const getConnectionNoHigherThanOrgAllows = async (conn: Connection, requestedVersion: string): Promise<Connection> => {
  // uses a TTL cache, so mostly won't hit the server
  const maxApiVersion = await conn.retrieveMaxApiVersion();
  if (requestedVersion && parseInt(requestedVersion, 10) > parseInt(maxApiVersion, 10)) {
    await Lifecycle.getInstance().emitWarning(
      `The requested API version (${requestedVersion}) is higher than the org supports.  Using ${maxApiVersion}.`
    );
    conn.setApiVersion(maxApiVersion);
  }
  return conn;
};
