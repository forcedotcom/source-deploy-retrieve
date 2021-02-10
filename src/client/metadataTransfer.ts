/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection } from '@salesforce/core';
import { EventEmitter } from 'events';
import { ComponentSet } from '../collections';
import { MetadataTransferError } from '../errors';
import { MetadataRequestResult, RequestStatus, SourceApiResult } from './types';

export interface MetadataTransferOptions {
  usernameOrConnection: string | Connection;
  components: ComponentSet;
}

export abstract class MetadataTransfer<U extends MetadataRequestResult, R extends SourceApiResult> {
  protected components: ComponentSet;
  private signalCancel = false;
  private event = new EventEmitter();
  private usernameOrConnection: string | Connection;

  constructor({ usernameOrConnection, components }: MetadataTransferOptions) {
    this.usernameOrConnection = usernameOrConnection;
    this.components = components;
  }

  /**
   * Start the metadata transfer.
   *
   * @param pollInterval Frequency in milliseconds to poll for operation status
   */
  public async start(pollInterval = 100): Promise<R | undefined> {
    try {
      const { id } = await this.pre();
      const apiResult = await this.pollStatus(id, pollInterval);

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

  public cancel(): void {
    this.signalCancel = true;
  }

  public onUpdate(subscriber: (result: U) => void): void {
    this.event.on('update', subscriber);
  }

  public onFinish(subscriber: (result: R) => void): void {
    this.event.on('finish', subscriber);
  }

  public onCancel(subscriber: (result: U | undefined) => void): void {
    this.event.on('cancel', subscriber);
  }

  public onError(subscriber: (result: Error) => void): void {
    this.event.on('error', subscriber);
  }

  protected async getConnection(): Promise<Connection> {
    if (typeof this.usernameOrConnection === 'string') {
      this.usernameOrConnection = await Connection.create({
        authInfo: await AuthInfo.create({ username: this.usernameOrConnection }),
      });
    }
    return this.usernameOrConnection;
  }

  private async pollStatus(id: string, interval: number): Promise<U> {
    let result: U;
    let triedOnce = false;

    try {
      while (true) {
        if (this.signalCancel) {
          const shouldBreak = await this.doCancel();
          if (shouldBreak) {
            if (result) {
              result.status = RequestStatus.Canceled;
            }
            return result;
          }
          this.signalCancel = false;
        }

        if (triedOnce) {
          await this.wait(interval);
        }

        result = await this.checkStatus(id);

        switch (result.status) {
          case RequestStatus.Succeeded:
          case RequestStatus.Canceled:
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

  protected abstract pre(): Promise<{ id: string }>;
  protected abstract checkStatus(id: string): Promise<U>;
  protected abstract post(result: U): Promise<R>;
  protected abstract doCancel(): Promise<boolean>;
}
