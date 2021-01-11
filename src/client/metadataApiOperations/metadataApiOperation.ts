/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Connection } from '@salesforce/core';
import { EventEmitter } from 'events';
import { DeployError } from '../../errors';
import { MetadataRequestResult, RequestStatus, SourceApiResult } from '../types';

export abstract class MetadataApiOperation<
  U extends MetadataRequestResult,
  R extends SourceApiResult
> {
  protected connection: Connection;
  private cancelling = false;
  private event = new EventEmitter();

  constructor(connection: Connection) {
    this.connection = connection;
  }

  public start(interval = 100): void {
    this.pre()
      .then(({ id }) => this.pollStatus(id, interval))
      .then(
        (result): Promise<R | undefined> => {
          if (result.status === RequestStatus.Canceled) {
            this.event.emit('cancel', result);
            return Promise.resolve(undefined);
          }
          return this.post(result);
        }
      )
      .then((sourceResult) => {
        if (sourceResult) {
          this.event.emit('finish', sourceResult);
        }
      })
      .catch((e) => this.event.emit('error', e));
  }

  public cancel(): void {
    this.cancelling = true;
  }

  public onUpdate(subscriber: (result: U) => void): void {
    this.event.on('update', subscriber);
  }

  public onFinish(subscriber: (result: R) => void): void {
    this.event.on('finish', subscriber);
  }

  public onCancel(subscriber: (result: U) => void): void {
    this.event.on('cancel', subscriber);
  }

  public onError(subscriber: (result: Error) => void): void {
    this.event.on('error', subscriber);
  }

  private async pollStatus(id: string, interval: number): Promise<U> {
    let result: U;
    let triedOnce = false;

    try {
      while (true) {
        if (this.cancelling) {
          const shouldBreak = this.doCancel();
          if (shouldBreak) {
            result.status = RequestStatus.Canceled;
            return result;
          }
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
      throw new DeployError('md_request_fail', e);
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
