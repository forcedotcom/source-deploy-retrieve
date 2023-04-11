/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { basename, join } from 'path';
import { MockTestOrgData, TestContext } from '@salesforce/core/lib/testSetup';
import { assert, expect } from 'chai';
import { AnyJson, getString } from '@salesforce/ts-types';
import { PollingClient, StatusResult, Messages } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import {
  ComponentSet,
  ComponentStatus,
  DeployMessage,
  DeployResult,
  FileResponse,
  MetadataApiDeploy,
  MetadataApiDeployStatus,
  registry,
  SourceComponent,
} from '../../src';
import {
  MOCK_ASYNC_RESULT,
  MOCK_RECENTLY_VALIDATED_ID_REST,
  MOCK_RECENTLY_VALIDATED_ID_SOAP,
  stubMetadataDeploy,
} from '../mock/client/transferOperations';
import { matchingContentFile } from '../mock';
import { META_XML_SUFFIX } from '../../src/common';
import {
  DECOMPOSED_CHILD_COMPONENT_1,
  DECOMPOSED_CHILD_COMPONENT_2,
  DECOMPOSED_COMPONENT,
} from '../mock/type-constants/customObjectConstant';
import { COMPONENT } from '../mock/type-constants/apexClassConstant';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');
const expectedError = {
  name: 'MissingJobIdError',
  message: messages.getMessage('error_no_job_id', ['deploy']),
};

describe('MetadataApiDeploy', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();

  beforeEach(async () => {
    await $$.stubAuths(testOrg);
  });

  describe('Lifecycle', () => {
    describe('start', () => {
      it('should not convert zip, but read from fs');
      it('should not mdapiDir, but generate zip buffer from it');

      it('should convert to metadata format and create zip', async () => {
        const components = new ComponentSet([matchingContentFile.COMPONENT]);
        const { operation, convertStub } = await stubMetadataDeploy($$, testOrg, {
          components,
        });

        await operation.start();

        expect(convertStub.calledWith(components, 'metadata', { type: 'zip' })).to.be.true;
      });

      it('should call deploy with zip', async () => {
        const components = new ComponentSet([matchingContentFile.COMPONENT]);
        const { operation, convertStub, deployStub } = await stubMetadataDeploy($$, testOrg, {
          components,
        });

        await operation.start();
        const { zipBuffer } = await convertStub.returnValues[0];

        expect(deployStub.calledOnce).to.be.true;
        expect(deployStub.firstCall.args[0]).to.equal(zipBuffer);
      });

      it('should save the temp directory if the environment variable is set', async () => {
        try {
          process.env.SFDX_MDAPI_TEMP_DIR = 'test';
          const components = new ComponentSet([matchingContentFile.COMPONENT]);
          const { operation, convertStub, deployStub } = await stubMetadataDeploy($$, testOrg, {
            components,
          });

          await operation.start();
          const { zipBuffer } = await convertStub.returnValues[0];

          expect(deployStub.calledOnce).to.be.true;
          expect(deployStub.firstCall.args[0]).to.equal(zipBuffer);
          expect(getString(convertStub.secondCall.args[2], 'outputDirectory', '')).to.equal('test');
        } finally {
          delete process.env.SFDX_MDAPI_TEMP_DIR;
        }
      });

      it('should NOT save the temp directory if the environment variable is NOT set', async () => {
        const components = new ComponentSet([matchingContentFile.COMPONENT]);
        const { operation, convertStub } = await stubMetadataDeploy($$, testOrg, {
          components,
        });

        await operation.start();

        // if the env var is set the callCount will be 2
        expect(convertStub.callCount).to.equal(1);
      });

      it('should return an AsyncResult', async () => {
        const component = matchingContentFile.COMPONENT;
        const deployedComponents = new ComponentSet([component]);
        const { operation } = await stubMetadataDeploy($$, testOrg, {
          components: deployedComponents,
        });

        const result = await operation.start();

        expect(result).to.deep.equal(MOCK_ASYNC_RESULT);
      });

      it('should set the deploy ID', async () => {
        const component = matchingContentFile.COMPONENT;
        const deployedComponents = new ComponentSet([component]);
        const { operation, response } = await stubMetadataDeploy($$, testOrg, {
          components: deployedComponents,
        });

        await operation.start();

        expect(operation.id).to.deep.equal(response.id);
      });
    });

    describe('pollStatus', () => {
      it('should construct a result object with deployed components', async () => {
        const component = matchingContentFile.COMPONENT;
        const deployedComponents = new ComponentSet([component]);
        const { operation, response } = await stubMetadataDeploy($$, testOrg, {
          components: deployedComponents,
        });

        await operation.start();
        const result = await operation.pollStatus();
        const expected = new DeployResult(response, deployedComponents);

        expect(result).to.deep.equal(expected);
      });

      it('should stop polling when checkStatus returns done = true', async () => {
        const { operation, checkStatusStub } = await stubMetadataDeploy($$, testOrg);
        checkStatusStub.withArgs(MOCK_ASYNC_RESULT.id, true).resolves({ done: true });

        await operation.start();
        await operation.pollStatus();

        expect(checkStatusStub.calledOnce).to.be.true;
      });

      it('should override timeout and frequency by number', async () => {
        const component = matchingContentFile.COMPONENT;
        const deployedComponents = new ComponentSet([component]);
        const { operation, pollingClientSpy } = await stubMetadataDeploy($$, testOrg, {
          components: deployedComponents,
        });
        const frequency = Duration.milliseconds(500);
        const timeout = Duration.seconds(30);

        await operation.start();
        await operation.pollStatus(frequency.milliseconds, timeout.seconds);

        const pollingClientOptions = pollingClientSpy.firstCall.args[0] as PollingClient.Options;
        expect(pollingClientOptions.frequency).to.deep.equal(frequency);
        expect(pollingClientOptions.timeout).to.deep.equal(timeout);
      });

      it('should override polling client options', async () => {
        const deployedComponents = new ComponentSet([matchingContentFile.COMPONENT]);
        const { operation, pollingClientSpy } = await stubMetadataDeploy($$, testOrg, {
          components: deployedComponents,
        });
        const frequency = Duration.milliseconds(500);
        const timeout = Duration.seconds(30);
        const poll = (): Promise<StatusResult> =>
          Promise.resolve({
            completed: true,
            payload: {} as AnyJson,
          });

        await operation.start();
        await operation.pollStatus({ frequency, timeout, poll });

        const pollingClientOptions = pollingClientSpy.firstCall.args[0] as PollingClient.Options;
        expect(pollingClientOptions.frequency).to.deep.equal(frequency);
        expect(pollingClientOptions.timeout).to.deep.equal(timeout);
        expect(pollingClientOptions.poll).to.deep.equal(poll);
      });
    });
  });

  describe('checkStatus', () => {
    it('should throw an error when a job ID is not set', async () => {
      const { operation } = await stubMetadataDeploy($$, testOrg);
      try {
        await operation.checkStatus();
        assert.fail('should have thrown an error');
      } catch (e) {
        assert(e instanceof Error);
        expect(e.name).to.equal(expectedError.name);
        expect(e.message).to.equal(expectedError.message);
      }
    });
  });

  describe('deployRecentValidation', () => {
    it('should return new ID for SOAP version', async () => {
      const { operation } = await stubMetadataDeploy($$, testOrg, {
        id: '1234',
        components: new ComponentSet(),
      });

      const result = await operation.deployRecentValidation(false);
      expect(result).to.equal(MOCK_RECENTLY_VALIDATED_ID_SOAP);
    });

    it('should return new ID for REST version', async () => {
      const { operation } = await stubMetadataDeploy($$, testOrg, {
        id: '1234',
        components: new ComponentSet(),
      });

      const result = await operation.deployRecentValidation(true);
      expect(result).to.equal(MOCK_RECENTLY_VALIDATED_ID_REST.id);
    });

    it('should throw an error when a job ID is not set', async () => {
      const { operation } = await stubMetadataDeploy($$, testOrg);
      try {
        await operation.deployRecentValidation(false);
        assert.fail('should have thrown an error');
      } catch (e) {
        assert(e instanceof Error);
        expect(e.name).to.equal(expectedError.name);
        expect(e.message).to.equal(expectedError.message);
      }
    });
  });

  describe('cancel', () => {
    it('should send cancelDeploy request to org if cancel is called', async () => {
      const { operation, invokeStub } = await stubMetadataDeploy($$, testOrg, {
        id: MOCK_ASYNC_RESULT.id,
        components: new ComponentSet(),
      });

      await operation.cancel();

      expect(invokeStub.calledOnce).to.be.true;
      expect(invokeStub.firstCall.args).to.deep.equal(['cancelDeploy', { id: MOCK_ASYNC_RESULT.id }]);
    });

    it('should throw an error when a job ID is not set', async () => {
      const { operation } = await stubMetadataDeploy($$, testOrg);
      try {
        await operation.cancel();
        assert.fail('should have thrown an error');
      } catch (e) {
        assert(e instanceof Error);
        expect(e.name).to.equal(expectedError.name);
        expect(e.message).to.equal(expectedError.message);
      }
    });
  });

  describe('DeployResult', () => {
    describe('getFileResponses', () => {
      describe('Sanitizing deploy messages', () => {
        it('should fix deploy message issue for "LightningComponentBundle" type', () => {
          const bundlePath = join('path', 'to', 'lwc', 'test');
          const props = {
            name: 'test',
            type: registry.types.lightningcomponentbundle,
            xml: join(bundlePath, 'test.js-meta.xml'),
            content: bundlePath,
          };
          const component = SourceComponent.createVirtualComponent(props, [
            {
              dirPath: bundlePath,
              children: [basename(props.xml), 'test.js', 'test.html'],
            },
          ]);
          const deployedSet = new ComponentSet([component]);
          const { fullName, type, xml } = component;
          assert(xml);
          const apiStatus: Partial<MetadataApiDeployStatus> = {
            details: {
              componentSuccesses: {
                changed: 'true',
                created: 'false',
                deleted: 'false',
                success: 'true',
                fullName,
                componentType: type.name,
              } as DeployMessage,
            },
          };
          const result = new DeployResult(apiStatus as MetadataApiDeployStatus, deployedSet);

          const responses = result.getFileResponses();
          const expected = component
            .walkContent()
            .map((f) => ({
              fullName,
              type: type.name,
              state: ComponentStatus.Changed,
              filePath: f,
            }))
            .concat({
              fullName,
              type: type.name,
              state: ComponentStatus.Changed,
              filePath: xml,
            }) as FileResponse[];

          expect(responses).to.deep.equal(expected);
        });

        describe('namespaced lwc failures', () => {
          const bundlePath = join('path', 'to', 'lwc', 'test');
          const props = {
            name: 'test',
            type: registry.types.lightningcomponentbundle,
            xml: join(bundlePath, 'test.js-meta.xml'),
            content: bundlePath,
          };
          const component = SourceComponent.createVirtualComponent(props, [
            {
              dirPath: bundlePath,
              children: [basename(props.xml), 'test.js', 'test.html'],
            },
          ]);
          const deployedSet = new ComponentSet([component]);
          const { fullName, type } = component;
          const problem = 'something went wrong';
          const problemType = 'Error';
          const componentSuccesses = {
            changed: 'true',
            created: 'false',
            deleted: 'false',
            success: 'true',
            fullName,
            componentType: type.name,
          } as DeployMessage;

          const componentFailures = {
            changed: 'false',
            created: 'false',
            deleted: 'false',
            success: 'false',
            problem,
            problemType,
            fileName: join(bundlePath, `${fullName}.html`),
            componentType: type.name,
          } as DeployMessage;

          it('should handle default namespace failure for "LightningComponentBundle" type', () => {
            const apiStatus: Partial<MetadataApiDeployStatus> = {
              details: {
                componentSuccesses,
                componentFailures: { ...componentFailures, fullName: `markup://c:${fullName}` },
              },
            };
            const result = new DeployResult(apiStatus as MetadataApiDeployStatus, deployedSet);

            const responses = result.getFileResponses();
            const expected = [
              {
                fullName,
                type: type.name,
                error: problem,
                problemType,
                state: ComponentStatus.Failed,
                filePath: componentFailures.fileName,
              },
            ] as FileResponse[];
            expect(responses).to.deep.equal(expected);
          });

          it('should handle custom namespace failure for "LightningComponentBundle" type', () => {
            const apiStatus: Partial<MetadataApiDeployStatus> = {
              details: {
                componentSuccesses,
                componentFailures: { ...componentFailures, fullName: `markup://my_NS:${fullName}` },
              },
            };
            const result = new DeployResult(apiStatus as MetadataApiDeployStatus, deployedSet);

            const responses = result.getFileResponses();
            const expected = [
              {
                fullName,
                type: type.name,
                error: problem,
                problemType,
                state: ComponentStatus.Failed,
                filePath: componentFailures.fileName,
              },
            ] as FileResponse[];
            expect(responses).to.deep.equal(expected);
          });
        });

        it('should report component as failed if component has success and failure messages', () => {
          const component = matchingContentFile.COMPONENT;
          const deployedSet = new ComponentSet([component]);
          const { fullName, type, content } = component;
          const problem = 'something went wrong';
          const problemType = 'Error';
          const apiStatus: Partial<MetadataApiDeployStatus> = {
            details: {
              componentSuccesses: {
                changed: 'true',
                created: 'false',
                deleted: 'false',
                success: 'true',
                fullName,
                componentType: type.name,
              } as DeployMessage,
              componentFailures: {
                changed: 'false',
                created: 'false',
                deleted: 'false',
                success: 'false',
                problem,
                problemType,
                fullName,
                fileName: content,
                componentType: type.name,
              } as DeployMessage,
            },
          };
          const result = new DeployResult(apiStatus as MetadataApiDeployStatus, deployedSet);

          const responses = result.getFileResponses();
          const expected = [
            {
              fullName,
              type: type.name,
              error: problem,
              problemType,
              state: ComponentStatus.Failed,
              filePath: content,
            },
          ] as FileResponse[];

          expect(responses).to.deep.equal(expected);
        });

        // folder types have a name like TestFolder/TestImageDoc
        // which may include a platform-specific separator TestFolder\\TestImageDoc
        it('should fix deploy message issue for "Document" type', () => {
          const type = registry.types.document;
          const name = 'test';
          const foldername = 'A_Folder';
          const contentName = `${name}.xyz`;
          const basePath = join('path', 'to', type.directoryName, foldername);
          const props = {
            name: join(foldername, name),
            type,
            xml: join(basePath, `${name}.document${META_XML_SUFFIX}`),
            content: join(basePath, contentName),
          };
          const component = SourceComponent.createVirtualComponent(props, [
            {
              dirPath: basePath,
              children: [basename(props.xml), basename(props.content)],
            },
          ]);
          const deployedSet = new ComponentSet([component]);
          const apiStatus: Partial<MetadataApiDeployStatus> = {
            details: {
              componentSuccesses: {
                changed: 'true',
                created: 'false',
                deleted: 'false',
                success: 'true',
                // fullname contains file extension that must be stripped
                fullName: join(foldername, name),
                componentType: type.name,
              } as DeployMessage,
            },
          };
          const result = new DeployResult(apiStatus as MetadataApiDeployStatus, deployedSet);

          const responses = result.getFileResponses();
          const expected = [
            {
              fullName: component.fullName,
              type: component.type.name,
              state: ComponentStatus.Changed,
              filePath: component.content,
            },
            {
              fullName: component.fullName,
              type: component.type.name,
              state: ComponentStatus.Changed,
              filePath: component.xml,
            },
          ];

          expect(responses).to.deep.equal(expected);
        });
      });

      it('should set "Changed" component status for changed component', () => {
        const component = matchingContentFile.COMPONENT;
        const deployedSet = new ComponentSet([component]);
        const { fullName, type, content, xml } = component;
        const apiStatus: Partial<MetadataApiDeployStatus> = {
          details: {
            componentSuccesses: {
              changed: 'true',
              created: 'false',
              deleted: 'false',
              fullName,
              componentType: type.name,
            } as DeployMessage,
          },
        };
        const result = new DeployResult(apiStatus as MetadataApiDeployStatus, deployedSet);

        const responses = result.getFileResponses();
        const expected: FileResponse[] = [
          {
            fullName,
            type: type.name,
            state: ComponentStatus.Changed,
            filePath: content,
          },
          {
            fullName,
            type: type.name,
            state: ComponentStatus.Changed,
            filePath: xml,
          },
        ];

        expect(responses).to.deep.equal(expected);
      });

      it('should set "Created" component status for changed component', () => {
        const component = matchingContentFile.COMPONENT;
        const deployedSet = new ComponentSet([component]);
        const { fullName, type, content, xml } = component;
        const apiStatus: Partial<MetadataApiDeployStatus> = {
          details: {
            componentSuccesses: {
              changed: 'false',
              created: 'true',
              deleted: 'false',
              fullName,
              componentType: type.name,
            } as DeployMessage,
          },
        };
        const result = new DeployResult(apiStatus as MetadataApiDeployStatus, deployedSet);

        const responses = result.getFileResponses();
        const expected: FileResponse[] = [
          {
            fullName,
            type: type.name,
            state: ComponentStatus.Created,
            filePath: content,
          },
          {
            fullName,
            type: type.name,
            state: ComponentStatus.Created,
            filePath: xml,
          },
        ];

        expect(responses).to.deep.equal(expected);
      });

      it('should set "Deleted" component status for deleted component', () => {
        const component = matchingContentFile.COMPONENT;
        const deployedSet = new ComponentSet([component]);
        const { fullName, type, content, xml } = component;
        const apiStatus: Partial<MetadataApiDeployStatus> = {
          details: {
            componentSuccesses: {
              changed: 'false',
              created: 'false',
              deleted: 'true',
              fullName,
              componentType: type.name,
            } as DeployMessage,
          },
        };
        const result = new DeployResult(apiStatus as MetadataApiDeployStatus, deployedSet);

        const responses = result.getFileResponses();
        const expected: FileResponse[] = [
          {
            fullName,
            type: type.name,
            state: ComponentStatus.Deleted,
            filePath: content,
          },
          {
            fullName,
            type: type.name,
            state: ComponentStatus.Deleted,
            filePath: xml,
          },
        ];

        expect(responses).to.deep.equal(expected);
      });

      it('should set "Failed" component status for failed component', () => {
        const component = matchingContentFile.COMPONENT;
        const deployedSet = new ComponentSet([component]);
        const { fullName, type, content } = component;
        const problem = 'something went wrong';
        const problemType = 'Error';
        const apiStatus: Partial<MetadataApiDeployStatus> = {
          details: {
            componentFailures: {
              changed: 'false',
              created: 'false',
              deleted: 'false',
              success: 'false',
              problem,
              problemType,
              fullName,
              fileName: component.content,
              componentType: type.name,
            } as DeployMessage,
          },
        };
        const result = new DeployResult(apiStatus as MetadataApiDeployStatus, deployedSet);

        const responses = result.getFileResponses();
        const expected: FileResponse[] = [
          {
            fullName,
            type: type.name,
            state: ComponentStatus.Failed,
            filePath: content,
            error: problem,
            problemType,
          },
        ];

        expect(responses).to.deep.equal(expected);
      });

      it('should set "Unchanged" component status for an unchanged component', () => {
        const component = matchingContentFile.COMPONENT;
        const deployedSet = new ComponentSet([component]);
        const { fullName, type, content, xml } = component;
        const apiStatus: Partial<MetadataApiDeployStatus> = {
          details: {
            componentSuccesses: {
              changed: 'false',
              created: 'false',
              deleted: 'false',
              success: 'true',
              fullName,
              componentType: type.name,
            } as DeployMessage,
          },
        };
        const result = new DeployResult(apiStatus as MetadataApiDeployStatus, deployedSet);

        const responses = result.getFileResponses();
        const expected: FileResponse[] = [
          {
            fullName,
            type: type.name,
            state: ComponentStatus.Unchanged,
            filePath: content,
          },
          {
            fullName,
            type: type.name,
            state: ComponentStatus.Unchanged,
            filePath: xml,
          },
        ];

        expect(responses).to.deep.equal(expected);
      });

      it('should aggregate diagnostics for a component', () => {
        const component = matchingContentFile.COMPONENT;
        const deployedSet = new ComponentSet([component]);
        const { fullName, type, content } = component;
        const problem = 'something went wrong';
        const problemType = 'Error';
        const apiStatus: Partial<MetadataApiDeployStatus> = {
          details: {
            componentFailures: [
              {
                changed: 'false',
                created: 'false',
                deleted: 'false',
                success: 'false',
                lineNumber: '3',
                columnNumber: '5',
                problem,
                problemType,
                fullName,
                fileName: component.content,
                componentType: type.name,
              } as DeployMessage,
              {
                changed: 'false',
                created: 'false',
                deleted: 'false',
                success: 'false',
                lineNumber: '12',
                columnNumber: '3',
                problem,
                problemType,
                fullName,
                fileName: component.content,
                componentType: type.name,
              } as DeployMessage,
            ],
          },
        };
        const result = new DeployResult(apiStatus as MetadataApiDeployStatus, deployedSet);

        const responses = result.getFileResponses();
        const expected: FileResponse[] = [
          {
            fullName,
            type: type.name,
            state: ComponentStatus.Failed,
            filePath: content,
            error: `${problem} (3:5)`,
            lineNumber: 3,
            columnNumber: 5,
            problemType,
          },
          {
            fullName,
            type: type.name,
            state: ComponentStatus.Failed,
            filePath: content,
            error: `${problem} (12:3)`,
            lineNumber: 12,
            columnNumber: 3,
            problemType,
          },
        ];

        expect(responses).to.deep.equal(expected);
      });

      it('should report children of deployed component', () => {
        const component = DECOMPOSED_COMPONENT;
        const deployedSet = new ComponentSet([component]);
        const apiStatus: Partial<MetadataApiDeployStatus> = {
          details: {
            componentSuccesses: [
              {
                changed: 'true',
                created: 'false',
                deleted: 'false',
                fullName: DECOMPOSED_CHILD_COMPONENT_1.fullName,
                componentType: DECOMPOSED_CHILD_COMPONENT_1.type.name,
              } as DeployMessage,
              {
                changed: 'true',
                created: 'false',
                deleted: 'false',
                fullName: DECOMPOSED_CHILD_COMPONENT_2.fullName,
                componentType: DECOMPOSED_CHILD_COMPONENT_2.type.name,
              } as DeployMessage,
              {
                changed: 'true',
                created: 'false',
                deleted: 'false',
                fullName: component.fullName,
                componentType: component.type.name,
              } as DeployMessage,
            ],
          },
        };
        const result = new DeployResult(apiStatus as MetadataApiDeployStatus, deployedSet);

        const responses = result.getFileResponses();
        const expected: FileResponse[] = [
          {
            fullName: DECOMPOSED_CHILD_COMPONENT_1.fullName,
            type: DECOMPOSED_CHILD_COMPONENT_1.type.name,
            state: ComponentStatus.Changed,
            filePath: DECOMPOSED_CHILD_COMPONENT_1.xml,
          },
          {
            fullName: DECOMPOSED_CHILD_COMPONENT_2.fullName,
            type: DECOMPOSED_CHILD_COMPONENT_2.type.name,
            state: ComponentStatus.Changed,
            filePath: DECOMPOSED_CHILD_COMPONENT_2.xml,
          },
          {
            fullName: component.fullName,
            type: component.type.name,
            state: ComponentStatus.Changed,
            filePath: component.xml,
          },
        ];

        expect(responses).to.deep.equal(expected);
      });

      it('should report "Deleted" when no component in org', () => {
        const component = COMPONENT;
        const deployedSet = new ComponentSet([component]);
        const apiStatus: Partial<MetadataApiDeployStatus> = {
          details: {
            componentFailures: {
              changed: 'false',
              created: 'false',
              deleted: 'false',
              fullName: 'destructiveChanges.xml',
              componentType: component.type.name,
              problem: `No ${component.type.name} named: ${component.fullName} found`,
              problemType: 'Warning',
            } as DeployMessage,
          },
        };
        const result = new DeployResult(apiStatus as MetadataApiDeployStatus, deployedSet);

        const responses = result.getFileResponses();
        const expected: FileResponse[] = [
          {
            fullName: component.fullName,
            type: component.type.name,
            state: ComponentStatus.Deleted,
            filePath: component.content,
          },
          {
            fullName: component.fullName,
            type: component.type.name,
            state: ComponentStatus.Deleted,
            filePath: component.xml,
          },
        ];

        expect(responses).to.deep.equal(expected);
      });

      it('should cache fileResponses', () => {
        const component = COMPONENT;
        const deployedSet = new ComponentSet([component]);
        const apiStatus: Partial<MetadataApiDeployStatus> = {
          details: {
            componentFailures: {
              changed: 'false',
              created: 'false',
              deleted: 'false',
              fullName: 'destructiveChanges.xml',
              componentType: component.type.name,
              problem: `No ${component.type.name} named: ${component.fullName} found`,
              problemType: 'Warning',
            } as DeployMessage,
          },
        };
        const result = new DeployResult(apiStatus as MetadataApiDeployStatus, deployedSet);
        // @ts-ignore testing private property
        const spy = $$.SANDBOX.spy(result, 'getDeployMessages');

        result.getFileResponses();
        expect(spy.callCount).to.equal(1);
        result.getFileResponses();
        expect(spy.callCount).to.equal(1);
      });
    });
  });

  describe('Constructor', () => {
    it('should allow zip file', () => {
      const mdApiDeploy = new MetadataApiDeploy({
        usernameOrConnection: 'testing',
        zipPath: 'foo/myZip.zip',
      });
      // @ts-ignore testing private property
      const mdOpts = mdApiDeploy.options;
      expect(mdOpts.zipPath).to.equal('foo/myZip.zip');
    });

    it('should allow mdapi path', () => {
      const mdApiDeploy = new MetadataApiDeploy({
        usernameOrConnection: 'testing',
        mdapiPath: 'foo/myDir',
      });
      // @ts-ignore testing private property
      const mdOpts = mdApiDeploy.options;
      expect(mdOpts.mdapiPath).to.equal('foo/myDir');
    });

    it('should merge default API options', () => {
      const mdApiDeploy = new MetadataApiDeploy({
        usernameOrConnection: 'testing',
        components: new ComponentSet(),
        apiOptions: {
          checkOnly: true,
          testLevel: 'RunLocalTests',
        },
      });
      // @ts-ignore testing private property
      const mdOpts = mdApiDeploy.options;
      expect(mdOpts.apiOptions).to.have.property('checkOnly', true);
      expect(mdOpts.apiOptions).to.have.property('rollbackOnError', true);
      expect(mdOpts.apiOptions).to.have.property('ignoreWarnings', false);
      expect(mdOpts.apiOptions).to.have.property('singlePackage', true);
      expect(mdOpts.apiOptions).to.have.property('testLevel', 'RunLocalTests');
    });

    it('should use default API options', () => {
      const mdApiDeploy = new MetadataApiDeploy({
        usernameOrConnection: 'testing',
        components: new ComponentSet(),
      });
      // @ts-ignore testing private property
      const mdOpts = mdApiDeploy.options;
      expect(mdOpts.apiOptions).to.have.property('rollbackOnError', true);
      expect(mdOpts.apiOptions).to.have.property('ignoreWarnings', false);
      expect(mdOpts.apiOptions).to.have.property('checkOnly', false);
      expect(mdOpts.apiOptions).to.have.property('singlePackage', true);
    });
  });
});
