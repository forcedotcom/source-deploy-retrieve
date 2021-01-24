/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { assert, createSandbox, SinonFakeTimers } from 'sinon';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { ComponentSet } from '../../../src';
import { MetadataOperation } from '../../../src/client/metadataOperatitons/metadataOperation';
import { MetadataRequestResult, RequestStatus, SourceApiResult } from '../../../src/client/types';
import { AuthInfo, Connection } from '@salesforce/core';
import { expect } from 'chai';
import { DeployError } from '../../../src/errors';
import { Done } from 'mocha';

const env = createSandbox();

class TestOperation extends MetadataOperation<MetadataRequestResult, SourceApiResult> {
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
  protected async checkStatus(id: string): Promise<MetadataRequestResult> {
    return this.lifecycle.checkStatus();
  }
  protected async post(result: MetadataRequestResult): Promise<SourceApiResult> {
    return this.lifecycle.post();
  }
  protected doCancel(): Promise<boolean> {
    return this.lifecycle.doCancel();
  }
}
const $$ = testSetup();

async function mockConnection(): Promise<Connection> {
  const testData = new MockTestOrgData();
  $$.setConfigStubContents('AuthInfoConfig', {
    contents: await testData.getConfig(),
  });
  return Connection.create({
    authInfo: await AuthInfo.create({
      username: testData.username,
    }),
  });
}

function validate(expectations: () => void, done: Done): void {
  let fail: Error;
  try {
    expectations();
  } catch (e) {
    fail = e;
  }
  done(fail);
}

describe('MetadataOperation', () => {
  let clock: SinonFakeTimers;
  let connection: Connection;

  let operation: TestOperation;

  beforeEach(async () => {
    clock = env.useFakeTimers();
    connection = await mockConnection();
    operation = new TestOperation({ components: new ComponentSet(), connection });
  });

  afterEach(() => env.restore());

  it('should run lifecycle in correct order', (done) => {
    const { pre, checkStatus, post } = operation.lifecycle;

    operation.start();

    operation.onFinish(() => {
      validate(() => {
        expect(pre.called).to.be.true;
        expect(checkStatus.calledAfter(pre)).to.be.true;
        expect(post.calledAfter(checkStatus)).to.be.true;
      }, done);
    });
  });

  describe('Polling', () => {
    it('should exit when request status is "Succeeded"', (done) => {
      operation.lifecycle.checkStatus.resolves({ status: RequestStatus.Succeeded });

      operation.start();

      operation.onFinish(() => done());
    });

    it('should exit when request status is "Failed"', (done) => {
      operation.lifecycle.checkStatus.resolves({ status: RequestStatus.Failed });

      operation.start();

      operation.onFinish(() => done());
    });

    it('should exit when request status is "Canceled"', (done) => {
      operation.lifecycle.checkStatus.resolves({ status: RequestStatus.Canceled });

      operation.start();

      operation.onCancel(() => done());
    });

    it('should wait if status checked at least once', (done) => {
      const { checkStatus } = operation.lifecycle;
      checkStatus.onFirstCall().returns({ status: RequestStatus.InProgress });
      checkStatus.onSecondCall().returns({ status: RequestStatus.Succeeded });

      /**
       * How this works:
       * 1) queue m1 (operation lifecycle)
       * 2) queue m2 (first queueMicrotask callback)
       * 3) run m1
       * 4) queue m3 (first status check) during m1
       * 5) run m2
       * 6) queue m4 (tick clock by 110 ms)
       * 7) run m3 (1st poll finishes, 2nd poll starts)
       * 8) queue m5 (wait before checking status again) during m3
       * 9) run m4
       * 10) run m5, (request finishes)
       */
      operation.start();
      queueMicrotask(() => {
        queueMicrotask(() => {
          clock.tick(110);
        });
      });

      operation.onFinish(() => {
        validate(() => {
          expect(operation.lifecycle.checkStatus.callCount).to.equal(2);
        }, done);
      });
    });

    it('should throw wrapped error if something goes wrong', (done) => {
      const { checkStatus } = operation.lifecycle;
      const originalError = new Error('whoops');
      const expectedError = new DeployError('md_request_fail', originalError.message);
      checkStatus.throws(originalError);

      operation.start();

      operation.onError((e) => {
        validate(() => {
          expect(e.name).to.deep.equal(expectedError.name);
          expect(e.message).to.deep.equal(expectedError.message);
        }, done);
      });
    });
  });

  describe('Cancellation', () => {
    it('should exit immediately if cancel operation finishes synchonously', (done) => {
      const { checkStatus, doCancel } = operation.lifecycle;

      operation.start();
      operation.cancel();

      operation.onCancel(() => {
        validate(() => {
          expect(doCancel.calledOnce).to.be.true;
          expect(checkStatus.calledOnce).to.be.false;
        }, done);
      });
    });

    it('should continue polling until cancel operation finishes asynchonously', (done) => {
      const { checkStatus, doCancel } = operation.lifecycle;
      checkStatus.returns({ status: RequestStatus.InProgress });
      doCancel.callsFake(() => {
        checkStatus.returns({ status: RequestStatus.Canceling });
        return false;
      });
      // doCancel.returns(false);

      operation.start();
      operation.cancel();

      queueMicrotask(() => {
        queueMicrotask(() => {
          queueMicrotask(() => {
            clock.tick(110);
            queueMicrotask(() => {
              clock.tick(110);
            });
          });
        });
      });

      operation.onUpdate((result) => {
        if (checkStatus.callCount === 2) {
          expect(result.status).to.equal(RequestStatus.Canceling);
          checkStatus.returns({ status: RequestStatus.Canceled });
        }
      });

      operation.onCancel(() => done());
    });
  });
});
