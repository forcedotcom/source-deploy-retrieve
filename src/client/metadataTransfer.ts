/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { EventEmitter } from 'node:events';
import { join } from 'node:path';
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
import fs from 'graceful-fs';
import { SfdxFileFormat } from '../convert/types';
import { MetadataConverter } from '../convert/metadataConverter';
import { ComponentSet } from '../collections/componentSet';
import { AsyncResult, MetadataRequestStatus, MetadataTransferResult, RequestStatus } from './types';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

export type MetadataTransferOptions = {
  usernameOrConnection: string | Connection;
  components?: ComponentSet;
  apiVersion?: string;
  id?: string;
};

export abstract class MetadataTransfer<
  Status extends MetadataRequestStatus,
  Result extends MetadataTransferResult,
  Options extends MetadataTransferOptions
> {
  protected components?: ComponentSet;
  protected logger: Logger;
  protected canceled = false;
  protected mdapiTempDir?: string;
  private transferId: Options['id'];
  private event = new EventEmitter();
  private usernameOrConnection: string | Connection;
  private apiVersion?: string;
  private consecutiveErrorRetries = 0;
  private errorRetryLimit = 0;
  private errorRetryLimitExceeded: { error: Error; count: number } | undefined;

  public constructor({ usernameOrConnection, components, apiVersion, id }: Options) {
    this.usernameOrConnection = usernameOrConnection;
    this.components = components;
    this.apiVersion = apiVersion;
    this.transferId = id;
    this.logger = Logger.childFromRoot(this.constructor.name);
    this.mdapiTempDir = process.env.SF_MDAPI_TEMP_DIR;
  }

  // if you passed in an id, you don't have to worry about whether there'll be one if you ask for it
  public get id(): Options['id'] {
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
    this.logger.debug(`Started metadata transfer. ID = ${this.id ?? '<no id>'}`);
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
  ): Promise<Result | undefined> {
    const normalizedOptions = normalizePollingInputs(frequencyOrOptions, timeout, sizeOfComponentSet(this.components));
    // Initialize error retry tracking
    this.consecutiveErrorRetries = 0;
    this.errorRetryLimit = calculateErrorRetryLimit(this.logger);
    this.errorRetryLimitExceeded = undefined;

    // IMPORTANT:
    // We omit passing the `retryLimit` option on purpose
    // to allow long-running deploy/retrieve jobs with low frequency checks to complete.
    //
    // https://forcedotcom.github.io/sfdx-core/types/status_pollingClient.PollingClient.Options.html#__type.retryLimit
    const pollingClient = await PollingClient.create({
      ...normalizedOptions,
      poll: this.poll.bind(this),
    });

    try {
      this.logger.debug(`Polling for metadata transfer status. ID = ${this.id ?? '<no id>'}`);
      this.logger.debug(`Polling frequency (ms): ${normalizedOptions.frequency.milliseconds}`);
      this.logger.debug(`Polling timeout (min): ${normalizedOptions.timeout.minutes}`);
      this.logger.debug(`Polling error retry limit (consecutive errors): ${this.errorRetryLimit}`);
      const completedMdapiStatus = (await pollingClient.subscribe()) as unknown as Status;

      // Check if polling exited due to error retry limit (throw unwrapped error)
      if (this.errorRetryLimitExceeded !== undefined) {
        const errorData: { error: Error; count: number } = this.errorRetryLimitExceeded;
        throw new SfError(
          messages.getMessage('error_retry_limit_exceeded', [errorData.count, errorData.error.message]),
          'MetadataTransferError'
        );
      }

      const result = await this.post(completedMdapiStatus);
      if (completedMdapiStatus.status === RequestStatus.Canceled) {
        this.event.emit('cancel', completedMdapiStatus);
      } else {
        this.event.emit('finish', result);
      }
      return result;
    } catch (e) {
      const err = e as Error | SfError;

      // Don't wrap the error retry limit exceeded error
      if (err instanceof SfError && err.message.includes('consecutive retryable errors')) {
        if (this.event.listenerCount('error') === 0) {
          throw err;
        }
        this.event.emit('error', err);
        return;
      }

      const error = new SfError(messages.getMessage('md_request_fail', [err.message]), 'MetadataTransferError');

      if (error.stack && err.stack) {
        // append the original stack to this new error
        error.stack += `\nDUE TO:\n${err.stack}`;

        if (err instanceof SfError && err.data) {
          // this keeps SfError data for failures in post deploy/retrieve.
          error.setData({
            id: this.id,
            causeErrorData: error.data,
          });

          error.actions = err.actions;
        } else {
          error.setData({
            id: this.id,
          });
        }
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
    if (this.mdapiTempDir) {
      await Lifecycle.getInstance().emitWarning(
        'The SF_MDAPI_TEMP_DIR environment variable is set, which may degrade performance'
      );
      this.logger.debug(
        `Converting metadata to: ${this.mdapiTempDir} because the SF_MDAPI_TEMP_DIR environment variable is set`
      );
      try {
        const source = cs ?? this.components ?? new ComponentSet();
        const outputDirectory = join(this.mdapiTempDir, target);
        await new MetadataConverter().convert(source, target, {
          type: 'directory',
          outputDirectory,
          genUniqueDir: false,
        });
        if (target === 'source') {
          // for source convert the package.xml isn't included so write it separately
          await fs.promises.writeFile(join(outputDirectory, 'package.xml'), await source.getPackageXml());
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

  // eslint-disable-next-line class-methods-use-this
  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    const retryableErrors = [
      'ENOMEM',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNRESET',
      'socket hang up',
      'connection timeout',
      'INVALID_QUERY_LOCATOR',
      'ERROR_HTTP_502',
      'ERROR_HTTP_503',
      'ERROR_HTTP_420',
      '<h1>Bad Message 400</h1><pre>reason: Bad Request</pre>',
      'Unable to complete the creation of the query cursor at this time',
      'Failed while fetching query cursor data for this QueryLocator',
      'Client network socket disconnected before secure TLS connection was established',
      'Unexpected internal servlet state',
    ];
    const isRetryable = (retryableNetworkError: string): boolean =>
      error.message.includes(retryableNetworkError) ||
      ('errorCode' in error && typeof error.errorCode === 'string' && error.errorCode.includes(retryableNetworkError));

    return retryableErrors.some(isRetryable);
  }

  private async poll(): Promise<StatusResult> {
    let completed = false;
    let mdapiStatus: Status | undefined;

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
        // Reset error counter on successful status check
        this.consecutiveErrorRetries = 0;
        completed = mdapiStatus?.done;
        if (!completed) {
          this.event.emit('update', mdapiStatus);
        }
      } catch (e) {
        this.logger.error(e);
        // tolerate a known mdapi problem 500/INVALID_CROSS_REFERENCE_KEY: invalid cross reference id
        // that happens when request moves out of Pending
        if (e instanceof Error && e.name === 'JsonParseError') {
          this.consecutiveErrorRetries++;
          if (this.consecutiveErrorRetries > this.errorRetryLimit) {
            // Store error info and signal completion to stop polling
            this.errorRetryLimitExceeded = {
              error: e,
              count: this.errorRetryLimit,
            };
            return { completed: true };
          }
          this.logger.debug('Metadata API response not parseable', e);
          await Lifecycle.getInstance().emitWarning('Metadata API response not parseable');
          return { completed: false };
        }

        // tolerate intermittent network errors up to error retry limit
        if (this.isRetryableError(e)) {
          this.consecutiveErrorRetries++;
          if (this.consecutiveErrorRetries > this.errorRetryLimit) {
            // Store error info and signal completion to stop polling
            this.errorRetryLimitExceeded = {
              error: e instanceof Error ? e : new Error(String(e)),
              count: this.errorRetryLimit,
            };
            return { completed: true };
          }
          this.logger.debug(
            `Network error on request (retry ${this.consecutiveErrorRetries}/${this.errorRetryLimit})`,
            e
          );
          await Lifecycle.getInstance().emitWarning('Network error occurred.  Continuing to poll.');
          return { completed: false };
        }
        throw e;
      }
    }
    this.logger.debug(`MDAPI status update: ${mdapiStatus.status}`);

    return { completed, payload: mdapiStatus as unknown as AnyJson };
  }

  public abstract checkStatus(): Promise<Status>;
  public abstract cancel(): Promise<void>;
  protected abstract pre(): Promise<AsyncResult>;
  protected abstract post(result: Status): Promise<Result>;
}

let emitted = false;
/* prevent requests on apiVersions higher than the org supports */
const getConnectionNoHigherThanOrgAllows = async (conn: Connection, requestedVersion?: string): Promise<Connection> => {
  // uses a TTL cache, so mostly won't hit the server
  const maxApiVersion = await conn.retrieveMaxApiVersion();
  if (requestedVersion && parseInt(requestedVersion, 10) > parseInt(maxApiVersion, 10)) {
    // the once function from kit wasn't working with this async method, manually create a "once" method for the warning
    if (!emitted) {
      await Lifecycle.getInstance().emitWarning(
        `The requested API version (${requestedVersion}) is higher than the org supports.  Using ${maxApiVersion}.`
      );
      emitted = true;
    }

    conn.setApiVersion(maxApiVersion);
  }
  return conn;
};

/** there's an options object OR 2 raw number param, there's defaults including freq based on the CS size */
export const normalizePollingInputs = (
  frequencyOrOptions?: number | Partial<PollingClient.Options>,
  timeout?: number,
  componentSetSize = 0
): Pick<PollingClient.Options, 'frequency' | 'timeout'> => {
  let pollingOptions: Pick<PollingClient.Options, 'frequency' | 'timeout'> = {
    frequency: Duration.milliseconds(calculatePollingFrequency(componentSetSize)),
    timeout: Duration.minutes(60),
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
  pollingOptions.frequency ??= Duration.milliseconds(calculatePollingFrequency(componentSetSize));
  pollingOptions.timeout ??= Duration.minutes(60);

  return pollingOptions;
};

/** yeah, there's a size property on CS.  But we want the actual number of source components */
const sizeOfComponentSet = (cs?: ComponentSet): number => cs?.getSourceComponents().toArray().length ?? 0;

/** based on the size of the components, pick a reasonable polling frequency */
export const calculatePollingFrequency = (size: number): number => {
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
};

/**
 * Calculate the maximum number of consecutive retryable errors allowed during polling.
 * This limit prevents infinite loops from repeated network/server errors while allowing
 * normal status polling to continue indefinitely (until timeout).
 *
 * Default is 1000 consecutive errors, which can be overridden via SF_METADATA_POLL_ERROR_RETRY_LIMIT.
 *
 * @param logger Logger instance for logging when env var override is used
 * @returns The maximum number of consecutive errors to tolerate
 */
export const calculateErrorRetryLimit = (logger: Logger): number => {
  const envRetryLimit = process.env.SF_METADATA_POLL_ERROR_RETRY_LIMIT;
  if (envRetryLimit) {
    const parsedLimit = parseInt(envRetryLimit, 10);
    if (!isNaN(parsedLimit) && parsedLimit > 0) {
      logger.debug(
        `Using error retry limit from SF_METADATA_POLL_ERROR_RETRY_LIMIT environment variable: ${parsedLimit}`
      );
      return parsedLimit;
    }
  }
  return 1000;
};
