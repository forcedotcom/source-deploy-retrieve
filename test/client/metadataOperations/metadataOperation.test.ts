/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { createSandbox, SinonFakeTimers } from 'sinon';
import { testSetup } from '@salesforce/core/lib/testSetup';
import { ComponentSet } from '../../../src';
import { MetadataOperation } from '../../../src/client/metadataOperatitons/metadataOperation';
import { MetadataRequestResult, RequestStatus, SourceApiResult } from '../../../src/client/types';
import { Connection } from '@salesforce/core';
import { expect } from 'chai';
import { DeployError } from '../../../src/errors';
import { Done } from 'mocha';
import { mockConnection } from '../../mock/client';

const $$ = testSetup();
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
    connection = await mockConnection($$);
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

      operation.start();
      queueMicrotask(() => {
        // schedule clock to break first poll wait after lifecycle starts
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
      checkStatus.returns({ status: RequestStatus.InProgress });

      operation.start();
      queueMicrotask(() => operation.cancel());

      operation.onCancel(() => {
        validate(() => {
          expect(doCancel.calledOnce).to.be.true;
          expect(checkStatus.calledOnce).to.be.true;
        }, done);
      });
    });

    it('should exit immediately and return undefined result if cancelled in same task', (done) => {
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
        // when cancel is called, set status to canceling
        checkStatus.returns({ status: RequestStatus.Canceling });
        return false;
      });

      operation.start();
      queueMicrotask(() => {
        // cancel right after lifecycle starts
        operation.cancel();
        queueMicrotask(() => {
          // schedule timer tick to break first wait
          queueMicrotask(() => {
            clock.tick(110);
            queueMicrotask(() => {
              // schedule timer tick to break second wait
              queueMicrotask(() => {
                clock.tick(110);
              });
            });
          });
        });
      });

      operation.onUpdate((result) => {
        if (checkStatus.callCount === 2) {
          // should be canceling by second poll
          expect(result.status).to.equal(RequestStatus.Canceling);
          // force third poll to have cancel status
          checkStatus.returns({ status: RequestStatus.Canceled });
        }
      });

      operation.onCancel(() => done());
    });
  });
});
