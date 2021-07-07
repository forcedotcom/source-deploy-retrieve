/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { createSandbox, SinonStub } from 'sinon';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { ComponentSet } from '../../src';
import { MetadataTransfer } from '../../src/client/metadataTransfer';
import {
  MetadataRequestStatus,
  MetadataTransferResult,
  RequestStatus,
} from '../../src/client/types';
import { AuthInfo, Connection } from '@salesforce/core';
import { expect } from 'chai';
import { MetadataTransferError } from '../../src/errors';
import { mockConnection } from '../mock/client';
import { fail } from 'assert';
import { sleep } from '@salesforce/kit';

const $$ = testSetup();
const env = createSandbox();

class TestTransfer extends MetadataTransfer<MetadataRequestStatus, MetadataTransferResult> {
  public request = { done: true, status: RequestStatus.Succeeded, id: '1', success: true };
  public lifecycle = {
    pre: env.stub().returns({ id: '1' }),
    checkStatus: env
      .stub()
      .returns({ done: true, status: RequestStatus.Succeeded, id: '1', success: true }),
    post: env.stub().returns({ id: '1' }),
    cancel: env.stub().returns(true),
  };
  public async checkStatus(): Promise<MetadataRequestStatus> {
    return this.lifecycle.checkStatus();
  }

  public async cancel(): Promise<void> {
    this.canceled = this.lifecycle.cancel();
  }

  protected async pre(): Promise<{ id: string }> {
    return this.lifecycle.pre();
  }

  protected async post(): Promise<MetadataTransferResult> {
    return this.lifecycle.post();
  }
}

describe('MetadataTransfer', () => {
  let connection: Connection;

  let operation: TestTransfer;

  beforeEach(async () => {
    connection = await mockConnection($$);
    operation = new TestTransfer({
      components: new ComponentSet(),
      usernameOrConnection: connection,
    });
  });

  afterEach(() => env.restore());

  it('should run lifecycle in correct order', async () => {
    const { pre, checkStatus, post } = operation.lifecycle;

    await operation.start();
    await operation.pollStatus();

    expect(pre.called).to.be.true;
    expect(checkStatus.calledAfter(pre)).to.be.true;
    expect(post.calledAfter(checkStatus)).to.be.true;
  });

  it('should set the _id property if passed in the constructor', () => {
    const TRANSFER_ID = '1234567890';
    const operation = new TestTransfer({
      components: new ComponentSet(),
      usernameOrConnection: connection,
      id: TRANSFER_ID,
    });
    expect(operation.id).to.equal(TRANSFER_ID);
  });

  it('should construct new Transfer without Id', () => {
    const operation = new TestTransfer({
      components: new ComponentSet(),
      usernameOrConnection: connection,
    });
    expect(operation.id).to.equal(undefined);
  });

  it('should initialize a Connection if a username is given', async () => {
    class TestTransferConnection extends TestTransfer {
      protected async pre(): Promise<{ id: string }> {
        const connection = await this.getConnection();
        return this.lifecycle.pre(connection);
      }
    }
    const testData = new MockTestOrgData();
    $$.setConfigStubContents('AuthInfoConfig', { contents: await testData.getConfig() });
    const authInfo = await AuthInfo.create({ username: 'foo@example.com' });
    env.stub(AuthInfo, 'create').withArgs({ username: 'foo@example.com' }).resolves(authInfo);
    env.stub(Connection, 'create').withArgs({ authInfo }).resolves(connection);
    operation = new TestTransferConnection({
      components: new ComponentSet(),
      usernameOrConnection: 'foo@example.com',
    });

    await operation.start();

    expect(operation.lifecycle.pre.firstCall.args[0]).to.equal(connection);
  });

  it('should initialize a Connection with overridden apiVersion if a username is given', async () => {
    class TestTransferConnection extends TestTransfer {
      protected async pre(): Promise<{ id: string }> {
        const connection = await this.getConnection();
        return this.lifecycle.pre(connection);
      }
    }
    const apiVersion = '50.0';
    const testData = new MockTestOrgData();
    $$.setConfigStubContents('AuthInfoConfig', { contents: await testData.getConfig() });
    const authInfo = await AuthInfo.create({ username: 'foo@example.com' });
    env.stub(AuthInfo, 'create').withArgs({ username: 'foo@example.com' }).resolves(authInfo);
    env.stub(Connection, 'create').withArgs({ authInfo }).resolves(connection);
    const setApiVersionSpy = env.spy(Connection.prototype, 'setApiVersion');
    operation = new TestTransferConnection({
      components: new ComponentSet(),
      usernameOrConnection: 'foo@example.com',
      apiVersion,
    });

    await operation.start();

    expect(operation.lifecycle.pre.firstCall.args[0]).to.equal(connection);
    expect(setApiVersionSpy.calledWith(apiVersion)).to.equal(true);
  });

  describe('Polling and Event Listeners', () => {
    let listenerStub: SinonStub;

    beforeEach(() => (listenerStub = env.stub()));

    it('should exit and fire "finish" event when done = true', async () => {
      const { checkStatus } = operation.lifecycle;
      checkStatus.resolves({ done: true });

      operation.onFinish(() => listenerStub());
      await operation.pollStatus();

      expect(checkStatus.callCount).to.equal(1);
      expect(listenerStub.callCount).to.equal(1);
    });

    it('should exit and fire "cancel" event when done = true and request status is "Canceled"', async () => {
      const { checkStatus } = operation.lifecycle;
      checkStatus.resolves({ status: RequestStatus.Canceled, done: true });

      operation.onCancel(() => listenerStub());
      await operation.pollStatus();

      expect(checkStatus.callCount).to.equal(1);
      expect(listenerStub.callCount).to.equal(1);
    });

    it('should wait for polling function to return before queing another', async () => {
      const { checkStatus } = operation.lifecycle;
      const checkStatusRuntime = 50;
      const callOrder: string[] = [];
      checkStatus.onFirstCall().callsFake(async () => {
        callOrder.push('firstCall1');
        await sleep(checkStatusRuntime);
        callOrder.push('firstCall2');
        return { done: false };
      });
      checkStatus.onSecondCall().callsFake(async () => {
        callOrder.push('secondCall1');
        return { done: true };
      });

      await operation.pollStatus(20);

      expect(checkStatus.callCount).to.equal(2);
      expect(callOrder).to.deep.equal(['firstCall1', 'firstCall2', 'secondCall1']);
    });

    it('should poll until timeout', async () => {
      // This test ensures that the core PollingClient doesn't stop
      // after 10 tries (the ts-retry-promise library default) and polls
      // until the timeout is exceeded.
      const { checkStatus } = operation.lifecycle;
      let callCount = 0;
      checkStatus.callsFake(async () => {
        callCount += 1;
        if (callCount > 22) {
          // This is a safeguard to ensure polling stops if the timeout
          // doesn't kick in.
          return { done: true };
        }
        return { done: false };
      });

      try {
        await operation.pollStatus(50, 1);
        fail('should have thrown an error');
      } catch (err) {
        expect(callCount).to.be.greaterThan(15);
        expect(err.name, 'Polling function should have timed out').to.equal(
          'MetadataTransferError'
        );
        expect(err.message).to.equal('Metadata API request failed: The client has timed out.');
      }
    });

    it('should emit wrapped error if something goes wrong', async () => {
      const { checkStatus } = operation.lifecycle;
      const originalError = new Error('whoops');
      const expectedError = new MetadataTransferError('md_request_fail', originalError.message);
      checkStatus.throws(originalError);

      let error: Error;
      operation.onError((e) => (error = e));
      await operation.pollStatus();

      expect(error.name).to.deep.equal(expectedError.name);
      expect(error.message).to.deep.equal(expectedError.message);
    });

    it('should throw wrapped error if there are no error listeners', async () => {
      const { checkStatus } = operation.lifecycle;
      const originalError = new Error('whoops');
      const expectedError = new MetadataTransferError('md_request_fail', originalError.message);
      checkStatus.throws(originalError);

      try {
        await operation.pollStatus();
        fail('should have thrown an error');
      } catch (e) {
        expect(e.name).to.deep.equal(expectedError.name);
        expect(e.message).to.deep.equal(expectedError.message);
      }
    });
  });

  describe('Cancellation', () => {
    it('should exit without calling checkStatus if transfer is immediately canceled', async () => {
      const { checkStatus } = operation.lifecycle;
      const cancelListenerStub = env.stub();
      const updateListenerStub = env.stub();
      operation.onCancel(() => cancelListenerStub());
      operation.onUpdate(() => updateListenerStub());

      await operation.start();
      const operationPromise = operation.pollStatus();
      await operation.cancel();
      const result = await operationPromise;

      expect(checkStatus.notCalled).to.be.true;
      expect(result).to.deep.equal({ id: '1' });
      expect(cancelListenerStub.callCount).to.equal(1);
      expect(updateListenerStub.callCount).to.equal(0);
    });

    it('should exit after checkStatus if transfer is marked for cancelation', async () => {
      const { checkStatus } = operation.lifecycle;
      const cancelListenerStub = env.stub();
      const updateListenerStub = env.stub();
      operation.onCancel(() => cancelListenerStub());
      operation.onUpdate(() => updateListenerStub());
      checkStatus.onFirstCall().callsFake(async () => {
        await operation.cancel();
        return { status: RequestStatus.InProgress, done: false };
      });

      await operation.start();
      const result = await operation.pollStatus();

      expect(checkStatus.calledOnce).to.be.true;
      expect(result).to.deep.equal({ id: '1' });
      expect(cancelListenerStub.callCount).to.equal(1);
      expect(updateListenerStub.callCount).to.equal(1);
    });
  });
});
