/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { createSandbox, SinonFakeTimers, SinonStub } from 'sinon';
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
    doCancel: env.stub().returns(true),
  };

  protected async pre(): Promise<{ id: string }> {
    return this.lifecycle.pre();
  }
  protected async checkStatus(id: string): Promise<MetadataRequestStatus> {
    return this.lifecycle.checkStatus();
  }
  protected async post(result: MetadataRequestStatus): Promise<MetadataTransferResult> {
    return this.lifecycle.post();
  }
  protected doCancel(): Promise<boolean> {
    return this.lifecycle.doCancel();
  }
}

describe('MetadataTransfer', () => {
  let clock: SinonFakeTimers;
  let connection: Connection;

  let operation: TestTransfer;

  beforeEach(async () => {
    clock = env.useFakeTimers();
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

    expect(pre.called).to.be.true;
    expect(checkStatus.calledAfter(pre)).to.be.true;
    expect(post.calledAfter(checkStatus)).to.be.true;
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

  describe('Polling and Event Listeners', () => {
    let listenerStub: SinonStub;

    beforeEach(() => (listenerStub = env.stub()));

    it('should exit when request status is "Succeeded"', async () => {
      const { checkStatus } = operation.lifecycle;
      checkStatus.resolves({ status: RequestStatus.Succeeded });

      operation.onFinish(() => listenerStub());
      await operation.start();

      expect(checkStatus.callCount).to.equal(1);
      expect(listenerStub.callCount).to.equal(1);
    });

    it('should exit when request status is "Failed"', async () => {
      const { checkStatus } = operation.lifecycle;
      checkStatus.resolves({ status: RequestStatus.Failed });

      operation.onFinish(() => listenerStub());
      await operation.start();

      expect(checkStatus.callCount).to.equal(1);
      expect(listenerStub.callCount).to.equal(1);
    });

    it('should exit when request status is "Canceled"', async () => {
      const { checkStatus } = operation.lifecycle;
      checkStatus.resolves({ status: RequestStatus.Canceled });

      operation.onCancel(() => listenerStub());
      await operation.start();

      expect(checkStatus.callCount).to.equal(1);
      expect(listenerStub.callCount).to.equal(1);
    });

    it('should wait if status checked at least once', async () => {
      const { checkStatus } = operation.lifecycle;
      checkStatus.onFirstCall().returns({ status: RequestStatus.InProgress });
      checkStatus.onSecondCall().returns({ status: RequestStatus.Succeeded });

      operation.onUpdate(() => listenerStub());
      const operationPromise = operation.start();
      queueMicrotask(() => {
        // schedule clock to break first poll wait after lifecycle starts
        queueMicrotask(() => {
          clock.tick(110);
        });
      });
      await operationPromise;

      expect(operation.lifecycle.checkStatus.callCount).to.equal(2);
      expect(listenerStub.callCount).to.equal(1);
    });

    it('should emit wrapped error if something goes wrong', async () => {
      const { checkStatus } = operation.lifecycle;
      const originalError = new Error('whoops');
      const expectedError = new MetadataTransferError('md_request_fail', originalError.message);
      checkStatus.throws(originalError);

      let error: Error;
      operation.onError((e) => (error = e));
      await operation.start();

      expect(error.name).to.deep.equal(expectedError.name);
      expect(error.message).to.deep.equal(expectedError.message);
    });

    it('should throw wrapped error if there are no error listeners', async () => {
      const { checkStatus } = operation.lifecycle;
      const originalError = new Error('whoops');
      const expectedError = new MetadataTransferError('md_request_fail', originalError.message);
      checkStatus.throws(originalError);

      try {
        await operation.start();
        fail('should have thrown an error');
      } catch (e) {
        expect(e.name).to.deep.equal(expectedError.name);
        expect(e.message).to.deep.equal(expectedError.message);
      }
    });
  });

  describe('Cancellation', () => {
    it('should exit immediately if cancel operation finishes synchonously', async () => {
      const { checkStatus, doCancel } = operation.lifecycle;
      checkStatus.returns({ status: RequestStatus.InProgress });

      const operationPromise = operation.start();
      queueMicrotask(() => operation.cancel());
      await operationPromise;

      expect(doCancel.calledOnce).to.be.true;
      expect(checkStatus.calledOnce).to.be.true;
    });

    it('should exit immediately and return undefined result if cancelled in same task', async () => {
      const { checkStatus, doCancel } = operation.lifecycle;

      const operationPromise = operation.start();
      operation.cancel();
      const result = await operationPromise;

      expect(doCancel.calledOnce).to.be.true;
      expect(checkStatus.calledOnce).to.be.false;
      expect(result).to.be.undefined;
    });

    it('should continue polling until cancel operation finishes asynchonously', async () => {
      const cancelListenerStub = env.stub();
      const { checkStatus, doCancel } = operation.lifecycle;
      checkStatus.returns({ status: RequestStatus.InProgress });
      doCancel.callsFake(() => {
        // when cancel is called, set status to canceling
        checkStatus.returns({ status: RequestStatus.Canceling });
        return false;
      });

      const operationPromise = operation.start();

      queueMicrotask(() => {
        // cancel right after lifecycle starts
        operation.cancel();
        queueMicrotask(() => {
          // schedule clock to break first wait
          queueMicrotask(() => {
            clock.tick(110);
            queueMicrotask(() => {
              // schedule clock to break second wait
              queueMicrotask(() => {
                clock.tick(110);
              });
            });
          });
        });
      });

      operation.onCancel(() => cancelListenerStub());

      operation.onUpdate((result) => {
        if (checkStatus.callCount === 2) {
          // should be canceling by second poll
          expect(result.status).to.equal(RequestStatus.Canceling);
          // force third poll to have cancel status
          checkStatus.returns({ status: RequestStatus.Canceled });
        }
      });

      await operationPromise;

      expect(cancelListenerStub.callCount).to.equal(1);
    });
  });
});
