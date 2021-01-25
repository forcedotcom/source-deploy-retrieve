/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { createSandbox, SinonStub } from 'sinon';
import { ComponentSet, MetadataConverter, registryData, SourceComponent } from '../../../src';
import { MetadataApiDeploy } from '../../../src/client/metadataOperatitons/metadataApiDeploy';
import { mockConnection } from '../../mock/client';
import { testSetup } from '@salesforce/core/lib/testSetup';
import {
  ComponentStatus,
  DeployMessage,
  DeployResult,
  RequestStatus,
} from '../../../src/client/types';
import { expect } from 'chai';
import { validate } from './metadataOperation.test';
import { KEANU_COMPONENT } from '../../mock/registry/keanuConstants';
import { basename, join } from 'path';

const env = createSandbox();
const $$ = testSetup();

interface StubLifecycleOptions {
  components?: ComponentSet;
  componentSuccesses?: Partial<DeployMessage> | Partial<DeployMessage>[];
  componentFailures?: Partial<DeployMessage> | Partial<DeployMessage>[];
}

interface StubbedLifecycle {
  deployStub: SinonStub;
  convertStub: SinonStub;
  checkStatusStub: SinonStub;
  invokeStub: SinonStub;
  operation: MetadataApiDeploy;
}

const zipBuffer = Buffer.from('1234');
const asyncResult = { id: '1234', state: RequestStatus.Pending, done: false };

async function stubLifecycle(
  options: StubLifecycleOptions = { components: new ComponentSet() }
): Promise<StubbedLifecycle> {
  const connection = await mockConnection($$);

  const deployStub = env.stub(connection.metadata, 'deploy');
  deployStub.withArgs(zipBuffer, MetadataApiDeploy.DEFAULT_OPTIONS).resolves(asyncResult);

  const convertStub = env.stub(MetadataConverter.prototype, 'convert');
  convertStub
    .withArgs(Array.from(options.components), 'metadata', { type: 'zip' })
    .resolves({ zipBuffer });

  const defaultStatus = { success: false, done: false, status: RequestStatus.Pending };
  const status: Partial<DeployResult> = Object.assign(defaultStatus, asyncResult);
  if (options.componentSuccesses) {
    if (options.componentFailures) {
      status.status = RequestStatus.SucceededPartial;
    } else {
      status.status = RequestStatus.Succeeded;
    }
    status.details = {};
    // @ts-ignore
    status.details.componentSuccesses = options.componentSuccesses;
    status.success = true;
  } else {
    status.status = RequestStatus.Failed;
    status.success = false;
  }
  if (options.componentFailures) {
    if (!status.details) {
      status.details = {};
    }
    // @ts-ignore
    status.details.componentFailures = options.componentFailures;
  }
  const checkStatusStub = env.stub(connection.metadata, 'checkDeployStatus');
  // @ts-ignore
  checkStatusStub.withArgs(asyncResult.id, true).resolves(status);

  // @ts-ignore
  const invokeStub = env.stub(connection.metadata, '_invoke');

  return {
    deployStub,
    convertStub,
    checkStatusStub,
    invokeStub,
    operation: new MetadataApiDeploy({
      connection,
      components: options.components,
    }),
  };
}

describe('Metadata API Deploy Operation', () => {
  afterEach(() => env.restore());

  it('should deploy zip buffer', (done) => {
    stubLifecycle().then(({ operation }) => {
      operation.start();

      operation.onFinish(() => done());
    });
  });

  describe('Deploy Result', () => {
    it('should set Changed component status for changed component', (done) => {
      stubLifecycle({
        components: new ComponentSet([KEANU_COMPONENT]),
        componentSuccesses: {
          changed: 'true',
          created: 'false',
          deleted: 'false',
          fullName: KEANU_COMPONENT.fullName,
          componentType: KEANU_COMPONENT.type.name,
        },
      }).then((lifecycle) => {
        lifecycle.operation.start();

        lifecycle.operation.onFinish((result) =>
          validate(() => {
            expect(result.components).to.deep.equal([
              {
                component: KEANU_COMPONENT,
                status: ComponentStatus.Changed,
                diagnostics: [],
              },
            ]);
          }, done)
        );
      });
    });

    it('should set Created component status for changed component', (done) => {
      stubLifecycle({
        components: new ComponentSet([KEANU_COMPONENT]),
        componentSuccesses: {
          changed: 'false',
          created: 'true',
          deleted: 'false',
          fullName: KEANU_COMPONENT.fullName,
          componentType: KEANU_COMPONENT.type.name,
        },
      }).then((lifecycle) => {
        lifecycle.operation.start();

        lifecycle.operation.onFinish((result) =>
          validate(() => {
            expect(result.components).to.deep.equal([
              {
                component: KEANU_COMPONENT,
                status: ComponentStatus.Created,
                diagnostics: [],
              },
            ]);
          }, done)
        );
      });
    });

    it('should set Deleted component status for deleted component', (done) => {
      stubLifecycle({
        components: new ComponentSet([KEANU_COMPONENT]),
        componentSuccesses: {
          changed: 'false',
          created: 'false',
          deleted: 'true',
          fullName: KEANU_COMPONENT.fullName,
          componentType: KEANU_COMPONENT.type.name,
        },
      }).then((lifecycle) => {
        lifecycle.operation.start();

        lifecycle.operation.onFinish((result) =>
          validate(() => {
            expect(result.components).to.deep.equal([
              {
                component: KEANU_COMPONENT,
                status: ComponentStatus.Deleted,
                diagnostics: [],
              },
            ]);
          }, done)
        );
      });
    });

    it('should set Failed component status for failed component', (done) => {
      stubLifecycle({
        components: new ComponentSet([KEANU_COMPONENT]),
        componentFailures: {
          success: 'false',
          changed: 'false',
          created: 'false',
          deleted: 'false',
          fullName: KEANU_COMPONENT.fullName,
          componentType: KEANU_COMPONENT.type.name,
        },
      }).then((lifecycle) => {
        lifecycle.operation.start();

        lifecycle.operation.onFinish((result) =>
          validate(() => {
            expect(result.components).to.deep.equal([
              {
                component: KEANU_COMPONENT,
                status: ComponentStatus.Failed,
                diagnostics: [],
              },
            ]);
          }, done)
        );
      });
    });

    it('should aggregate diagnostics for a component', (done) => {
      stubLifecycle({
        components: new ComponentSet([KEANU_COMPONENT]),
        componentFailures: [
          {
            success: 'false',
            changed: 'false',
            created: 'false',
            deleted: 'false',
            fullName: KEANU_COMPONENT.fullName,
            componentType: KEANU_COMPONENT.type.name,
            problem: 'Expected ;',
            problemType: 'Error',
            lineNumber: '3',
            columnNumber: '7',
          },
          {
            success: 'false',
            changed: 'false',
            created: 'false',
            deleted: 'false',
            fullName: KEANU_COMPONENT.fullName,
            componentType: KEANU_COMPONENT.type.name,
            problem: 'Symbol test does not exist',
            problemType: 'Error',
            lineNumber: '8',
            columnNumber: '23',
          },
        ],
      }).then((lifecycle) => {
        lifecycle.operation.start();

        lifecycle.operation.onFinish((result) =>
          validate(() => {
            expect(result.components).to.deep.equal([
              {
                component: KEANU_COMPONENT,
                status: ComponentStatus.Failed,
                diagnostics: [
                  {
                    lineNumber: 3,
                    columnNumber: 7,
                    message: 'Expected ;',
                    type: 'Error',
                  },
                  {
                    lineNumber: 8,
                    columnNumber: 23,
                    message: 'Symbol test does not exist',
                    type: 'Error',
                  },
                ],
              },
            ]);
          }, done)
        );
      });
    });

    it('should fix lwc deploy message issue', (done) => {
      const bundlePath = join('path', 'to', 'lwc', 'test');
      const props = {
        name: 'test',
        type: registryData.types.lightningcomponentbundle,
        xml: join(bundlePath, 'test.js-meta.xml'),
        content: bundlePath,
      };
      const component = SourceComponent.createVirtualComponent(props, [
        {
          dirPath: bundlePath,
          children: [basename(props.xml), 'test.js', 'test.html'],
        },
      ]);
      stubLifecycle({
        components: new ComponentSet([component]),
        componentSuccesses: [
          {
            changed: 'false',
            created: 'true',
            deleted: 'false',
            // expect api to return fullname without the scheme, but alas
            fullName: `markup://c:${component.fullName}`,
            componentType: component.type.name,
          },
        ],
      }).then((lifecycle) => {
        lifecycle.operation.start();

        lifecycle.operation.onFinish((result) =>
          validate(() => {
            expect(result.components).to.deep.equal([
              {
                component,
                status: ComponentStatus.Created,
                diagnostics: [],
              },
            ]);
          }, done)
        );
      });
    });
  });

  describe('Cancellation', () => {
    it('should cancel immediately if cancelDeploy call returns done = true', (done) => {
      stubLifecycle().then(({ operation, checkStatusStub, invokeStub }) => {
        invokeStub.withArgs('cancelDeploy', { id: asyncResult.id }).returns({ done: true });

        operation.start();
        operation.cancel();

        operation.onCancel(() =>
          validate(() => {
            expect(checkStatusStub.notCalled).to.be.true;
          }, done)
        );
      });
    });

    it('should async cancel if cancelDeploy call returns done = false', (done) => {
      stubLifecycle().then(({ operation, checkStatusStub, invokeStub }) => {
        invokeStub.withArgs('cancelDeploy', { id: asyncResult.id }).returns({ done: false });
        checkStatusStub.withArgs(asyncResult.id, true).resolves({ status: RequestStatus.Canceled });

        operation.start();
        operation.cancel();

        operation.onCancel(() =>
          validate(() => {
            expect(checkStatusStub.calledOnce).to.be.true;
          }, done)
        );
      });
    });
  });
});
