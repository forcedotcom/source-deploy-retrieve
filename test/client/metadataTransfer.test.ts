/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { fail } from 'assert';
import { SinonStub } from 'sinon';
import { AuthInfo, Connection, PollingClient, Messages } from '@salesforce/core';
import { assert, expect } from 'chai';
import { Duration, sleep } from '@salesforce/kit';
import { MockTestOrgData, TestContext } from '@salesforce/core/lib/testSetup';
import { ComponentSet } from '../../src';
import { MetadataTransfer, MetadataTransferOptions } from '../../src/client/metadataTransfer';
import { MetadataRequestStatus, MetadataTransferResult, RequestStatus } from '../../src/client/types';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

describe('MetadataTransfer', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();

  class TestTransfer extends MetadataTransfer<MetadataRequestStatus, MetadataTransferResult, MetadataTransferOptions> {
    public request = { done: true, status: RequestStatus.Succeeded, id: '1', success: true };
    public lifecycle = {
      pre: $$.SANDBOX.stub().returns({ id: '1' }),
      checkStatus: $$.SANDBOX.stub().returns({ done: true, status: RequestStatus.Succeeded, id: '1', success: true }),
      post: $$.SANDBOX.stub().returns({ id: '1' }),
      cancel: $$.SANDBOX.stub().returns(true),
    };
    // eslint-disable-next-line @typescript-eslint/require-await
    public async checkStatus(): Promise<MetadataRequestStatus> {
      return this.lifecycle.checkStatus();
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async cancel(): Promise<void> {
      this.canceled = this.lifecycle.cancel();
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    protected async pre(): Promise<{ id: string }> {
      return this.lifecycle.pre();
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    protected async post(): Promise<MetadataTransferResult> {
      return this.lifecycle.post();
    }
  }

  let connection: Connection;

  let operation: TestTransfer;

  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    connection = await testOrg.getConnection();
    operation = new TestTransfer({
      components: new ComponentSet(),
      usernameOrConnection: connection,
    });
  });

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
    const username = connection.getUsername();
    assert(username);
    const authInfo = await AuthInfo.create({ username });
    $$.SANDBOX.stub(AuthInfo, 'create').withArgs({ username }).resolves(authInfo);
    $$.SANDBOX.stub(Connection, 'create').withArgs({ authInfo }).resolves(connection);
    operation = new TestTransferConnection({
      components: new ComponentSet(),
      usernameOrConnection: username,
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
    const username = connection.getUsername();
    assert(username);

    const authInfo = await AuthInfo.create({ username });
    $$.SANDBOX.stub(AuthInfo, 'create').withArgs({ username }).resolves(authInfo);
    $$.SANDBOX.stub(Connection, 'create').withArgs({ authInfo }).resolves(connection);
    const setApiVersionSpy = $$.SANDBOX.spy(Connection.prototype, 'setApiVersion');
    operation = new TestTransferConnection({
      components: new ComponentSet(),
      usernameOrConnection: username,
      apiVersion,
    });

    await operation.start();

    expect(operation.lifecycle.pre.firstCall.args[0]).to.equal(connection);
    expect(setApiVersionSpy.calledWith(apiVersion)).to.equal(true);
  });

  it('caps api version at the org max', async () => {
    class TestTransferConnection extends TestTransfer {
      protected async pre(): Promise<{ id: string }> {
        const connection = await this.getConnection();
        return this.lifecycle.pre(connection);
      }
    }
    const apiVersion = '51.0';
    const maxApiVersion = '50.0';
    const username = connection.getUsername();
    assert(username);

    const authInfo = await AuthInfo.create({ username });
    $$.SANDBOX.stub(AuthInfo, 'create').withArgs({ username }).resolves(authInfo);
    $$.SANDBOX.stub(Connection, 'create').withArgs({ authInfo }).resolves(connection);
    $$.SANDBOX.stub(connection, 'retrieveMaxApiVersion').resolves(maxApiVersion);
    const setApiVersionSpy = $$.SANDBOX.spy(Connection.prototype, 'setApiVersion');
    operation = new TestTransferConnection({
      components: new ComponentSet(),
      usernameOrConnection: username,
      apiVersion,
    });

    await operation.start();

    expect(setApiVersionSpy.calledWith(maxApiVersion)).to.equal(true);
  });

  describe('Polling and Event Listeners', () => {
    let listenerStub: SinonStub;

    beforeEach(() => (listenerStub = $$.SANDBOX.stub()));

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

    it('should calculate polling frequency based on source components, 0 -> 1000', async () => {
      const pollingClientStub = $$.SANDBOX.stub(PollingClient, 'create').resolves(PollingClient.prototype);
      $$.SANDBOX.stub(PollingClient.prototype, 'subscribe').resolves({ status: RequestStatus.Canceled, done: true });
      const { checkStatus } = operation.lifecycle;
      checkStatus.resolves({ status: RequestStatus.Canceled, done: true });

      operation.onCancel(() => listenerStub());
      await operation.pollStatus();

      expect(pollingClientStub.calledOnce).to.be.true;
      expect((pollingClientStub.firstCall.args[0] as { frequency: number }).frequency).to.deep.equal(
        Duration.milliseconds(1000)
      );
    });

    it('should calculate polling frequency based on source components, 10 -> 100', async () => {
      // @ts-ignore protected member access
      $$.SANDBOX.stub(operation.components, 'getSourceComponents').returns({
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore only override length attribute
        toArray: () => ({ length: 10 }),
      });
      const pollingClientStub = $$.SANDBOX.stub(PollingClient, 'create').resolves(PollingClient.prototype);
      $$.SANDBOX.stub(PollingClient.prototype, 'subscribe').resolves({ status: RequestStatus.Canceled, done: true });
      const { checkStatus } = operation.lifecycle;
      checkStatus.resolves({ status: RequestStatus.Canceled, done: true });

      operation.onCancel(() => listenerStub());
      await operation.pollStatus({ frequency: undefined, timeout: Duration.minutes(60) });

      expect(pollingClientStub.calledOnce).to.be.true;
      expect((pollingClientStub.firstCall.args[0] as { frequency: number }).frequency).to.deep.equal(
        Duration.milliseconds(100)
      );
    });

    it('should calculate polling frequency based on source components, 2520 -> 2520', async () => {
      // @ts-ignore protected member access
      $$.SANDBOX.stub(operation.components, 'getSourceComponents').returns({
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore only override length attribute
        toArray: () => ({ length: 2520 }),
      });
      const pollingClientStub = $$.SANDBOX.stub(PollingClient, 'create').resolves(PollingClient.prototype);
      $$.SANDBOX.stub(PollingClient.prototype, 'subscribe').resolves({ status: RequestStatus.Canceled, done: true });
      const { checkStatus } = operation.lifecycle;
      checkStatus.resolves({ status: RequestStatus.Canceled, done: true });

      operation.onCancel(() => listenerStub());
      await operation.pollStatus(undefined, 60);

      expect(pollingClientStub.calledOnce).to.be.true;
      expect((pollingClientStub.firstCall.args[0] as { frequency: number }).frequency).to.deep.equal(
        Duration.milliseconds(2520)
      );
    });

    it('should wait for polling function to return before queuing another', async () => {
      const { checkStatus } = operation.lifecycle;
      const checkStatusRuntime = 50;
      const callOrder: string[] = [];
      checkStatus.onFirstCall().callsFake(async () => {
        callOrder.push('firstCall1');
        await sleep(checkStatusRuntime);
        callOrder.push('firstCall2');
        return { done: false };
      });
      // eslint-disable-next-line @typescript-eslint/require-await
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
      // eslint-disable-next-line @typescript-eslint/require-await
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
        assert(err instanceof Error);
        expect(err.name, 'Polling function should have timed out').to.equal('MetadataTransferError');
        expect(err.message).to.equal('Metadata API request failed: The client has timed out.');
      }
    });

    it('should emit wrapped error if something goes wrong', async () => {
      const { checkStatus } = operation.lifecycle;
      const originalError = new Error('whoops');
      const expectedError = {
        name: 'MetadataTransferError',
        message: messages.getMessage('md_request_fail', [originalError.message]),
      };
      checkStatus.throws(originalError);
      let error: Error | undefined;
      operation.onError((e) => (error = e));
      await operation.pollStatus();
      assert(error instanceof Error);
      expect(error.name).to.deep.equal(expectedError.name);
      expect(error.message).to.deep.equal(expectedError.message);
    });

    it('should tolerate network errors', async () => {
      const { checkStatus } = operation.lifecycle;
      const networkError1 = new Error('something something ETIMEDOUT something');
      const networkError2 = new Error('something something ENOTFOUND something');
      checkStatus.onFirstCall().throws(networkError1);
      checkStatus.onSecondCall().throws(networkError2);
      checkStatus.onThirdCall().resolves({ done: true });

      await operation.pollStatus();
      expect(checkStatus.callCount).to.equal(3);
    });

    it('should tolerate known mdapi error', async () => {
      const { checkStatus } = operation.lifecycle;
      const networkError1 = new Error('foo');
      networkError1.name = 'JsonParseError';
      checkStatus.onFirstCall().throws(networkError1);
      checkStatus.onSecondCall().throws(networkError1);
      checkStatus.onThirdCall().resolves({ done: true });

      await operation.pollStatus();
      expect(checkStatus.callCount).to.equal(3);
    });

    it('should tolerate 2 known mdapi errors', async () => {
      const { checkStatus } = operation.lifecycle;
      checkStatus.onFirstCall().throws(new Error('<h1>Bad Message 400</h1><pre>reason: Bad Request</pre>'));
      checkStatus.onSecondCall().throws(new Error('INVALID_QUERY_LOCATOR'));
      checkStatus.onThirdCall().resolves({ done: true });

      await operation.pollStatus();
      expect(checkStatus.callCount).to.equal(3);
    });

    it('should tolerate known mdapi error', async () => {
      const { checkStatus } = operation.lifecycle;
      const networkError1 = new Error('foo');
      networkError1.name = 'JsonParseError';
      checkStatus.onFirstCall().throws(networkError1);
      checkStatus.onSecondCall().throws(networkError1);
      checkStatus.onThirdCall().resolves({ done: true });

      await operation.pollStatus();
      expect(checkStatus.callCount).to.equal(3);
    });

    it('should throw wrapped error if there are no error listeners', async () => {
      const { checkStatus } = operation.lifecycle;
      const originalError = new Error('whoops');
      const expectedError = {
        name: 'MetadataTransferError',
        message: messages.getMessage('md_request_fail', [originalError.message]),
      };
      checkStatus.throws(originalError);

      try {
        await operation.pollStatus();
        fail('should have thrown an error');
      } catch (e) {
        assert(e instanceof Error);
        expect(e.name).to.deep.equal(expectedError.name);
        expect(e.message).to.deep.equal(expectedError.message);
      }
    });
  });

  describe('Cancellation', () => {
    it('should exit without calling checkStatus if transfer is immediately canceled', async () => {
      const { checkStatus } = operation.lifecycle;
      const cancelListenerStub = $$.SANDBOX.stub();
      const updateListenerStub = $$.SANDBOX.stub();
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
      const cancelListenerStub = $$.SANDBOX.stub();
      const updateListenerStub = $$.SANDBOX.stub();
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
