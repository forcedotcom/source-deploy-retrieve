/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { testSetup } from '@salesforce/core/lib/testSetup';
import { expect } from 'chai';
import { Done } from 'mocha';
import { join, sep } from 'path';
import { createSandbox, match, SinonStub } from 'sinon';
import {
  ComponentSet,
  ConvertOutputConfig,
  MetadataConverter,
  SourceComponent,
} from '../../../src';
import { MetadataApiRetrieve } from '../../../src/client/metadataOperatitons';
import {
  FileProperties,
  RequestStatus,
  RetrieveMessage,
  RetrieveResult,
} from '../../../src/client/types';
import { createMockZip, mockConnection } from '../../mock/client';
import { mockRegistry } from '../../mock/registry';
import { KATHY_COMPONENTS } from '../../mock/registry/kathyConstants';
import { KEANU_COMPONENT } from '../../mock/registry/keanuConstants';

const env = createSandbox();
const $$ = testSetup();

export function validate(done: Done, expectations: () => void): void {
  let fail: Error;
  try {
    expectations();
  } catch (e) {
    fail = e;
  }
  env.restore();
  done(fail);
}

interface StubLifecycleOptions {
  merge?: boolean;
  components?: ComponentSet;
  successes?: ComponentSet;
  messages?: Partial<RetrieveMessage> | Partial<RetrieveMessage>[];
  fileProperties?: Partial<FileProperties> | Partial<FileProperties>[];
  failures?: ComponentSet;
}

interface StubbedLifecycle {
  retrieveStub: SinonStub;
  checkStatusStub: SinonStub;
  convertStub: SinonStub;
  operation: MetadataApiRetrieve;
}

const asyncResult = { id: '1234', state: RequestStatus.Pending, done: false };
const defaultOutput = sep + 'test';

async function stubLifecycle(
  options: StubLifecycleOptions = { merge: false }
): Promise<StubbedLifecycle> {
  const connection = await mockConnection($$);
  const { components } = options;
  const zipBuffer = await createMockZip([
    'unpackaged/package.xml',
    join('unpackaged', KEANU_COMPONENT.content),
    join('unpackaged', KEANU_COMPONENT.xml),
  ]);

  const retrieveStub = env.stub(connection.metadata, 'retrieve');
  retrieveStub
    // @ts-ignore required callback
    .withArgs({
      apiVersion: components.apiVersion,
      unpackaged: components.getObject().Package,
    })
    .resolves(asyncResult);

  const defaultStatus: Partial<RetrieveResult> = {
    id: asyncResult.id,
    status: RequestStatus.Pending,
    success: false,
    done: false,
    zipFile: zipBuffer.toString('base64'),
  };
  if (options.fileProperties) {
    defaultStatus.success = true;
    // @ts-ignore
    defaultStatus.fileProperties = options.fileProperties;
    defaultStatus.status = options.failures
      ? RequestStatus.SucceededPartial
      : RequestStatus.Succeeded;
  } else {
    defaultStatus.success = false;
    defaultStatus.status = RequestStatus.Failed;
  }
  if (options.messages) {
    // @ts-ignore
    defaultStatus.messages = options.messages;
  }
  const checkStatusStub = env.stub(connection.metadata, 'checkRetrieveStatus');
  // @ts-ignore force returning project's RetrieveResult type
  checkStatusStub.withArgs(asyncResult.id).resolves(defaultStatus);

  const source = Array.from(components.getSourceComponents());

  let outputConfig: ConvertOutputConfig;
  let converted: SourceComponent[] = [];
  if (options.merge) {
    outputConfig = {
      type: 'merge',
      mergeWith: components.getSourceComponents(),
      defaultDirectory: defaultOutput,
    };
    converted = source;
  } else {
    outputConfig = {
      type: 'directory',
      outputDirectory: defaultOutput,
    };
    for (const component of components) {
      const sc = new SourceComponent({
        name: component.fullName,
        type: component.type,
        xml: join(defaultOutput, `${component.fullName}.${component.type.suffix}-meta.xml`),
        content: join(defaultOutput, `${component.fullName}.${component.type.suffix}`),
      });
      converted.push(sc);
    }
  }
  const convertStub = env.stub(MetadataConverter.prototype, 'convert');
  convertStub.withArgs(match.any, 'source', outputConfig).resolves({ converted });

  return {
    retrieveStub,
    checkStatusStub,
    convertStub,
    operation: new MetadataApiRetrieve({
      connection,
      components,
      defaultOutput,
      registry: mockRegistry,
      merge: options.merge,
    }),
  };
}

describe('MetadataApiRetrieve', () => {
  it('should retrieve zip and extract to directory', (done) => {
    const component = KEANU_COMPONENT;
    const components = new ComponentSet([component], mockRegistry);
    stubLifecycle({
      components,
      fileProperties: {
        fullName: component.fullName,
        type: component.type.name,
        fileName: component.content,
      },
    }).then(({ operation, convertStub }) => {
      operation.start();

      operation.onFinish(() => {
        validate(done, () => {
          expect(convertStub.calledOnce).to.be.true;
          expect(
            convertStub.calledWith(match.any, 'source', {
              type: 'directory',
              outputDirectory: defaultOutput,
            })
          ).to.be.true;
        });
      });
    });
  });

  it('should retrieve zip and merge with existing components', (done) => {
    const component = KEANU_COMPONENT;
    const components = new ComponentSet([component], mockRegistry);
    stubLifecycle({
      components,
      merge: true,
      fileProperties: {
        fullName: component.fullName,
        type: component.type.name,
        fileName: component.content,
      },
    }).then((lifecycle) => {
      const { operation, convertStub } = lifecycle;

      operation.start();

      operation.onFinish(() => {
        validate(done, () => {
          expect(convertStub.calledOnce).to.be.true;
          expect(
            convertStub.calledWith(match.any, 'source', {
              type: 'merge',
              mergeWith: components.getSourceComponents(),
              defaultDirectory: defaultOutput,
            })
          ).to.be.true;
        });
      });
    });
  });

  describe('Cancellation', () => {
    it('should immediately stop polling', (done) => {
      const component = KEANU_COMPONENT;
      const components = new ComponentSet([component], mockRegistry);
      stubLifecycle({ components }).then(({ operation, checkStatusStub }) => {
        operation.start();
        operation.cancel();

        operation.onCancel(() => {
          validate(done, () => {
            expect(checkStatusStub.notCalled).to.be.true;
          });
        });
      });
    });
  });

  describe('Retrieve Result', () => {
    it('should return successfully retrieved components', (done) => {
      const component = KEANU_COMPONENT;
      const fileProperties = {
        fullName: component.fullName,
        type: component.type.name,
        fileName: component.content,
      };
      stubLifecycle({
        components: new ComponentSet([KEANU_COMPONENT], mockRegistry),
        merge: true,
        fileProperties,
      }).then(({ operation }) => {
        operation.start();

        operation.onFinish((result) => {
          validate(done, () => {
            expect(result.status).to.equal(RequestStatus.Succeeded);
            expect(result.successes).to.deep.equal([
              {
                component,
                properties: fileProperties,
              },
            ]);
          });
        });
      });
    });

    it('should report components that failed to be retrieved', (done) => {
      const component = KEANU_COMPONENT;
      const message = `Failed to retrieve components of type '${component.type.name}' named '${component.fullName}'`;
      stubLifecycle({
        components: new ComponentSet([KEANU_COMPONENT], mockRegistry),
        messages: { problem: message },
      }).then(({ operation }) => {
        operation.start();

        operation.onFinish((result) => {
          validate(done, () => {
            expect(result.status).to.equal(RequestStatus.Failed);
            expect(result.failures).to.deep.equal([
              {
                component: {
                  fullName: component.fullName,
                  type: component.type,
                },
                message,
              },
            ]);
          });
        });
      });
    });

    it('should report both successful and failed components', (done) => {
      const components = [KEANU_COMPONENT, KATHY_COMPONENTS[0], KATHY_COMPONENTS[1]];
      const messages = [
        `Failed to retrieve components of type '${components[0].type.name}' named '${components[0].fullName}'`,
        `Failed to retrieve components of type '${components[1].type.name}' named '${components[1].fullName}'`,
      ];
      const fileProperties = {
        fullName: components[2].fullName,
        type: components[2].type.name,
        fileName: components[2].xml,
      };
      stubLifecycle({
        components: new ComponentSet(components, mockRegistry),
        messages: messages.map((m) => ({ problem: m })),
        merge: true,
        fileProperties,
      }).then(({ operation }) => {
        operation.start();

        operation.onFinish((result) => {
          validate(done, () => {
            expect(result.status).to.equal(RequestStatus.SucceededPartial);
            expect(result.successes).to.deep.equal([
              {
                component: components[2],
                properties: fileProperties,
              },
            ]);
            expect(result.failures).to.deep.equal([
              {
                component: {
                  fullName: components[0].fullName,
                  type: components[0].type,
                },
                message: messages[0],
              },
              {
                component: {
                  fullName: components[1].fullName,
                  type: components[1].type,
                },
                message: messages[1],
              },
            ]);
          });
        });
      });
    });

    it('should report generic failure', (done) => {
      const message = 'Something went wrong';

      stubLifecycle({
        components: new ComponentSet([KEANU_COMPONENT], mockRegistry),
        messages: { problem: message },
      }).then(({ operation }) => {
        operation.start();

        operation.onFinish((result) => {
          validate(done, () => {
            expect(result.status).to.equal(RequestStatus.Failed);
            expect(result.failures).to.deep.equal([{ message }]);
          });
        });
      });
    });

    it('should ignore retrieved "Package" metadata type', (done) => {
      const component = KEANU_COMPONENT;
      const fileProperties = [
        {
          fullName: component.fullName,
          type: component.type.name,
          fileName: component.content,
        },
        {
          fullName: 'package.xml',
          type: 'Package',
          fileName: 'package.xml',
        },
      ];
      stubLifecycle({
        components: new ComponentSet([KEANU_COMPONENT], mockRegistry),
        merge: true,
        fileProperties,
      }).then(({ operation }) => {
        operation.start();

        operation.onFinish((result) => {
          validate(done, () => {
            expect(result.status).to.equal(RequestStatus.Succeeded);
            expect(result.successes).to.deep.equal([
              {
                component,
                properties: fileProperties[0],
              },
            ]);
          });
        });
      });
    });
  });
});
