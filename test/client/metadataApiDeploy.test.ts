/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { basename, join, sep } from 'node:path';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import chai, { assert, expect } from 'chai';
import { AnyJson, ensureString, getString } from '@salesforce/ts-types';
import { Connection, envVars, Lifecycle, Messages, PollingClient, StatusResult } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import deepEqualInAnyOrder from 'deep-equal-in-any-order';
import * as sinon from 'sinon';
import fs from 'graceful-fs';
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
  DECOMPOSED_CHILD_XML_PATH_1,
  DECOMPOSED_CHILD_XML_PATH_2,
  DECOMPOSED_COMPONENT,
  DECOMPOSED_XML_PATH,
} from '../mock/type-constants/customObjectConstant';
import { COMPONENT } from '../mock/type-constants/apexClassConstant';
import * as deployMessages from '../../src/client/deployMessages';

chai.use(deepEqualInAnyOrder);

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
      it('should convert to metadata format and create zip', async () => {
        const components = new ComponentSet([matchingContentFile.COMPONENT]);
        const { operation, convertStub } = await stubMetadataDeploy($$, testOrg, {
          components,
        });

        expect(components.getAiAuthoringBundles().toArray()).to.be.empty;

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
          process.env.SF_MDAPI_TEMP_DIR = 'test';
          const components = new ComponentSet([matchingContentFile.COMPONENT]);
          const { operation, convertStub, deployStub } = await stubMetadataDeploy($$, testOrg, {
            components,
          });

          await operation.start();
          const { zipBuffer } = await convertStub.returnValues[0];

          expect(deployStub.calledOnce).to.be.true;
          expect(deployStub.firstCall.args[0]).to.equal(zipBuffer);
          // @ts-expect-error protected property
          const expectedDir = join(operation.mdapiTempDir, 'metadata');
          expect(expectedDir.startsWith(`test${sep}`)).to.be.true;
          expect(getString(convertStub.secondCall.args[2], 'outputDirectory', '')).to.equal(expectedDir);
        } finally {
          delete process.env.SF_MDAPI_TEMP_DIR;
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

      it('should call warnIfDeployThresholdExceeded', async () => {
        const component = matchingContentFile.COMPONENT;
        const deployedComponents = new ComponentSet([component]);
        const { operation, response } = await stubMetadataDeploy($$, testOrg, {
          components: deployedComponents,
        });
        // @ts-expect-error stubbing private method
        const warnStub = $$.SANDBOX.spy(operation, 'warnIfDeployThresholdExceeded');

        await operation.start();

        expect(operation.id).to.deep.equal(response.id);
        expect(warnStub.callCount).to.equal(1, 'warnIfDeployThresholdExceeded() should have been called');
        // 4 is the expected byte size (zipBuffer is set to '1234')
        // undefined is expected since we're not computing the number of files in the zip
        expect(warnStub.firstCall.args).to.deep.equal([4, undefined]);
      });
    });

    describe('warnIfDeployThresholdExceeded', () => {
      let emitWarningStub: sinon.SinonStub;

      beforeEach(() => {
        emitWarningStub = $$.SANDBOX.stub(Lifecycle.prototype, 'emitWarning').resolves();
      });

      it('should emit warning with default threshold when zipSize > 80%', async () => {
        const loggerDebugSpy = $$.SANDBOX.spy($$.TEST_LOGGER, 'debug');
        const mdapThis = { logger: $$.TEST_LOGGER };
        // @ts-expect-error testing private method
        await MetadataApiDeploy.prototype.warnIfDeployThresholdExceeded.call(mdapThis, 31_200_001, 8000);
        expect(emitWarningStub.calledOnce, 'emitWarning for fileSize should have been called').to.be.true;
        const warningMsg =
          'Deployment zip file size is approaching the Metadata API limit (~39MB). Warning threshold is 80%';
        expect(emitWarningStub.firstCall.args[0]).to.include(warningMsg);
        expect(loggerDebugSpy.called).to.be.false;
      });

      it('should emit warning with default threshold when zipFileCount > 80%', async () => {
        const loggerDebugSpy = $$.SANDBOX.spy($$.TEST_LOGGER, 'debug');
        const mdapThis = { logger: $$.TEST_LOGGER };
        // @ts-expect-error testing private method
        await MetadataApiDeploy.prototype.warnIfDeployThresholdExceeded.call(mdapThis, 31_200_000, 8001);
        expect(emitWarningStub.calledOnce, 'emitWarning for fileSize should have been called').to.be.true;
        const warningMsg =
          'Deployment zip file count is approaching the Metadata API limit (10,000). Warning threshold is 80%';
        expect(emitWarningStub.firstCall.args[0]).to.include(warningMsg);
        expect(loggerDebugSpy.called).to.be.false;
      });

      it('should not emit warning but log debug output when threshold >= 100%', async () => {
        const loggerDebugSpy = $$.SANDBOX.spy($$.TEST_LOGGER, 'debug');
        $$.SANDBOX.stub(envVars, 'getNumber').returns(100);
        const mdapThis = { logger: $$.TEST_LOGGER };
        // @ts-expect-error testing private method
        await MetadataApiDeploy.prototype.warnIfDeployThresholdExceeded.call(mdapThis, 310_200_000, 12_000);
        expect(emitWarningStub.called).to.be.false;
        expect(loggerDebugSpy.calledOnce).to.be.true;
        const expectedMsg = 'Deploy size warning is disabled since SF_DEPLOY_SIZE_THRESHOLD is overridden to: 100';
        expect(loggerDebugSpy.firstCall.args[0]).to.equal(expectedMsg);
      });

      it('should emit warnings and log debug output with exceeded overridden threshold', async () => {
        const loggerDebugSpy = $$.SANDBOX.spy($$.TEST_LOGGER, 'debug');
        $$.SANDBOX.stub(envVars, 'getNumber').returns(75);
        const mdapThis = { logger: $$.TEST_LOGGER };
        // @ts-expect-error testing private method
        await MetadataApiDeploy.prototype.warnIfDeployThresholdExceeded.call(mdapThis, 29_250_001, 7501);
        expect(emitWarningStub.calledTwice, 'emitWarning for fileSize and fileCount should have been called').to.be
          .true;
        const fileSizeWarningMsg =
          'Deployment zip file size is approaching the Metadata API limit (~39MB). Warning threshold is 75%';
        const fileCountWarningMsg =
          'Deployment zip file count is approaching the Metadata API limit (10,000). Warning threshold is 75%';
        expect(emitWarningStub.firstCall.args[0]).to.include(fileSizeWarningMsg);
        expect(emitWarningStub.secondCall.args[0]).to.include(fileCountWarningMsg);
        expect(loggerDebugSpy.calledOnce).to.be.true;
        const expectedMsg = 'Deploy size warning threshold has been overridden by SF_DEPLOY_SIZE_THRESHOLD to: 75';
        expect(loggerDebugSpy.firstCall.args[0]).to.equal(expectedMsg);
      });

      it('should NOT emit warnings but log debug output with overridden threshold that is not exceeded', async () => {
        const loggerDebugSpy = $$.SANDBOX.spy($$.TEST_LOGGER, 'debug');
        $$.SANDBOX.stub(envVars, 'getNumber').returns(75);
        const mdapThis = { logger: $$.TEST_LOGGER };
        // @ts-expect-error testing private method
        await MetadataApiDeploy.prototype.warnIfDeployThresholdExceeded.call(mdapThis, 29_250_000, 7500);
        expect(emitWarningStub.called, 'emitWarning should not have been called').to.be.false;
        expect(loggerDebugSpy.calledOnce).to.be.true;
        const expectedMsg = 'Deploy size warning threshold has been overridden by SF_DEPLOY_SIZE_THRESHOLD to: 75';
        expect(loggerDebugSpy.firstCall.args[0]).to.equal(expectedMsg);
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
        const zipMeta = { zipSize: 4, zipFileCount: undefined };
        const expected = new DeployResult(response, deployedComponents, undefined, zipMeta);

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

    it('should pass isRestDeploy=true to checkDeployStatus', async () => {
      const options = {
        id: MOCK_ASYNC_RESULT.id,
        apiOptions: { rest: true },
        components: new ComponentSet(),
      };
      const { operation, checkStatusStub } = await stubMetadataDeploy($$, testOrg, options);
      await operation.checkStatus();
      expect(checkStatusStub.calledOnce).to.be.true;
      expect(checkStatusStub.firstCall.firstArg).to.equal(MOCK_ASYNC_RESULT.id);
      expect(checkStatusStub.firstCall.args[1]).to.equal(true);
      expect(checkStatusStub.firstCall.args[2]).to.equal(true);
    });

    it('should pass isRestDeploy=false to checkDeployStatus', async () => {
      const options = {
        id: MOCK_ASYNC_RESULT.id,
        components: new ComponentSet(),
      };
      const { operation, checkStatusStub } = await stubMetadataDeploy($$, testOrg, options);
      await operation.checkStatus();
      expect(checkStatusStub.calledOnce).to.be.true;
      expect(checkStatusStub.firstCall.firstArg).to.equal(MOCK_ASYNC_RESULT.id);
      expect(checkStatusStub.firstCall.args[1]).to.equal(true);
      expect(checkStatusStub.firstCall.args[2]).to.equal(false);
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
            filePath: ensureString(content),
          },
          {
            fullName,
            type: type.name,
            state: ComponentStatus.Changed,
            filePath: ensureString(xml),
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
            filePath: ensureString(content),
          },
          {
            fullName,
            type: type.name,
            state: ComponentStatus.Created,
            filePath: ensureString(xml),
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
            filePath: ensureString(content),
          },
          {
            fullName,
            type: type.name,
            state: ComponentStatus.Deleted,
            filePath: ensureString(xml),
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
            filePath: ensureString(content),
          },
          {
            fullName,
            type: type.name,
            state: ComponentStatus.Unchanged,
            filePath: ensureString(xml),
          },
        ];

        expect(responses).to.deep.equal(expected);
      });

      it('should return line/col numbers for mdapi deploy', () => {
        const component = matchingContentFile.COMPONENT;
        const { fullName, type } = component;
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
        // intentionally don't include the componentSet
        const result = new DeployResult(apiStatus as MetadataApiDeployStatus);
        const fileResponses = result.getFileResponses();
        assert(fileResponses[0].state === ComponentStatus.Failed);
        expect(fileResponses[0].lineNumber).equal(3);
        expect(fileResponses[0].columnNumber).equal(5);
        assert(fileResponses[1].state === ComponentStatus.Failed);
        expect(fileResponses[1].lineNumber).equal(12);
        expect(fileResponses[1].columnNumber).equal(3);
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

      it('should warn when extra server responses found', () => {
        // everything is an emit.  Warn calls emit, too.
        const warnSpy = $$.SANDBOX.stub(Lifecycle.prototype, 'emitWarning');
        const emitSpy = $$.SANDBOX.stub(Lifecycle.prototype, 'emit');

        const component = matchingContentFile.COMPONENT;
        const deployedSet = new ComponentSet([component]);
        const { fullName, type } = component;

        const apiStatus: Partial<MetadataApiDeployStatus> = {
          details: {
            componentFailures: [
              {
                changed: 'true',
                created: 'false',
                deleted: 'false',
                success: 'true',
                fullName,
                fileName: component.content,
                componentType: type.name,
              } as DeployMessage,
              {
                changed: 'false',
                created: 'false',
                deleted: 'true',
                success: 'true',
                fullName: 'myServerOnlyComponent',
                fileName: 'myServerOnlyComponent',
                componentType: type.name,
              } as DeployMessage,
            ],
          },
        };
        const result = new DeployResult(apiStatus as MetadataApiDeployStatus, deployedSet);

        const responses = result.getFileResponses();
        const expected: FileResponse[] = [
          {
            filePath: join('path', 'to', 'classes', 'myComponent.cls'),
            fullName: 'myComponent',
            state: ComponentStatus.Changed,
            type: 'ApexClass',
          },
          {
            filePath: join('path', 'to', 'classes', 'myComponent.cls-meta.xml'),
            fullName: 'myComponent',
            state: ComponentStatus.Changed,
            type: 'ApexClass',
          },
        ];

        expect(responses).to.deep.equal(expected);
        expect(warnSpy.called).to.be.true;
        expect(warnSpy.args[0]).to.deep.equal([
          'ApexClass, myServerOnlyComponent, returned from org, but not found in the local project',
        ]);

        warnSpy.restore();
        emitSpy.restore();
      });
      it('should NOT warn when empty component set used', () => {
        // everything is an emit.  Warn calls emit, too.
        const warnSpy = $$.SANDBOX.stub(Lifecycle.prototype, 'emitWarning');
        const emitSpy = $$.SANDBOX.stub(Lifecycle.prototype, 'emit');

        const component = matchingContentFile.COMPONENT;
        const deployedSet = new ComponentSet([]);
        const { fullName, type } = component;

        const apiStatus: Partial<MetadataApiDeployStatus> = {
          details: {
            componentFailures: [
              {
                changed: 'true',
                created: 'false',
                deleted: 'false',
                success: 'true',
                fullName,
                fileName: component.content,
                componentType: type.name,
              } as DeployMessage,
              {
                changed: 'false',
                created: 'false',
                deleted: 'true',
                success: 'true',
                fullName: 'myServerOnlyComponent',
                fileName: 'myServerOnlyComponent',
                componentType: type.name,
              } as DeployMessage,
            ],
          },
        };
        const result = new DeployResult(apiStatus as MetadataApiDeployStatus, deployedSet);

        const responses = result.getFileResponses();

        expect(responses).to.deep.equal([]);
        expect(warnSpy.called).to.be.false;

        warnSpy.restore();
        emitSpy.restore();
      });

      it('should not report duplicates component', () => {
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
                lineNumber: '3',
                columnNumber: '5',
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
                fileName: DECOMPOSED_CHILD_XML_PATH_1,
                createdDate: '',
                success: true,
              },
              {
                changed: 'true',
                created: 'false',
                deleted: 'false',
                fullName: DECOMPOSED_CHILD_COMPONENT_2.fullName,
                componentType: DECOMPOSED_CHILD_COMPONENT_2.type.name,
                fileName: DECOMPOSED_CHILD_XML_PATH_2,
                createdDate: '',
                success: true,
              },
              {
                changed: 'true',
                created: 'false',
                deleted: 'false',
                fullName: component.fullName,
                componentType: component.type.name,
                fileName: DECOMPOSED_XML_PATH,
                createdDate: '',
                success: true,
              },
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
            filePath: ensureString(DECOMPOSED_CHILD_COMPONENT_1.xml),
          },
          {
            fullName: DECOMPOSED_CHILD_COMPONENT_2.fullName,
            type: DECOMPOSED_CHILD_COMPONENT_2.type.name,
            state: ComponentStatus.Changed,
            filePath: ensureString(DECOMPOSED_CHILD_COMPONENT_2.xml),
          },
          {
            fullName: component.fullName,
            type: component.type.name,
            state: ComponentStatus.Changed,
            filePath: ensureString(component.xml),
          },
        ];

        expect(responses).to.deep.equalInAnyOrder(expected);
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
            filePath: ensureString(component.content),
          },
          {
            fullName: component.fullName,
            type: component.type.name,
            state: ComponentStatus.Deleted,
            filePath: ensureString(component.xml),
          },
        ];

        expect(responses).to.deep.equal(expected);
      });

      it('should return FileResponses for web_app DigitalExperienceBundle with child files', () => {
        const bundlePath = join('path', 'to', 'digitalExperiences', 'web_app', 'zenith');
        const props = {
          name: 'web_app/zenith',
          type: registry.types.digitalexperiencebundle,
          content: bundlePath,
        };
        const component = SourceComponent.createVirtualComponent(props, [
          {
            dirPath: bundlePath,
            children: ['index.html', 'app.js', 'style.css'],
          },
        ]);
        const deployedSet = new ComponentSet([component]);
        const { fullName, type } = component;
        const apiStatus: Partial<MetadataApiDeployStatus> = {
          details: {
            componentSuccesses: {
              changed: 'false',
              created: 'true',
              deleted: 'false',
              success: 'true',
              fullName,
              componentType: type.name,
            } as DeployMessage,
          },
        };
        const result = new DeployResult(apiStatus as MetadataApiDeployStatus, deployedSet);

        const responses = result.getFileResponses();

        // Should have 1 bundle response + 3 file responses
        expect(responses).to.have.lengthOf(4);

        // First response should be the bundle
        expect(responses[0]).to.deep.include({
          fullName: 'web_app/zenith',
          type: 'DigitalExperienceBundle',
          state: ComponentStatus.Created,
          filePath: bundlePath,
        });

        // Remaining responses should be DigitalExperience child files
        const childResponses = responses.slice(1);
        childResponses.forEach((response) => {
          expect(response.type).to.equal('DigitalExperience');
          expect(response.fullName).to.match(/^web_app\/zenith\//);
          expect(response.state).to.equal(ComponentStatus.Created);
        });
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
        const spy = $$.SANDBOX.spy(deployMessages, 'getDeployMessages');

        result.getFileResponses();
        expect(spy.callCount).to.equal(1);
        result.getFileResponses();
        expect(spy.callCount).to.equal(1);
      });

      it('should prepend projectDirectory to filePaths when projectDirectory differs from cwd', () => {
        const component = matchingContentFile.COMPONENT;
        const projectDir = join('my', 'project', 'dir');
        const deployedSet = new ComponentSet([component]);
        deployedSet.projectDirectory = projectDir;
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
            filePath: join(projectDir, ensureString(content)),
          },
          {
            fullName,
            type: type.name,
            state: ComponentStatus.Changed,
            filePath: join(projectDir, ensureString(xml)),
          },
        ];

        expect(responses).to.deep.equal(expected);
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

    it('should disallow "RunRelevantTests" for API versions <66.0', () => {
      const testCases = ['8.0', '10.0', '60.0', '65.0'];
      const constructorError = {
        name: 'InvalidTestLevelSelection',
        message: messages.getMessage('error_invalid_test_level', ['RunRelevantTests', '66.0']),
      };
      try {
        testCases.forEach((v) => {
          new MetadataApiDeploy({
            usernameOrConnection: 'testing',
            apiOptions: {
              testLevel: 'RunRelevantTests',
            },
            apiVersion: v,
          });
          assert.fail(`Should have thrown an error for API version ${v}`);
        });
      } catch (e) {
        assert(e instanceof Error);
        expect(e.name).to.equal(constructorError.name);
        expect(e.message).to.equal(constructorError.message);
      }
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

  describe('AiAuthoringBundle compilation', () => {
    const aabType = registry.types.aiauthoringbundle;
    const aabName = 'TestAAB';
    const aabContentDir = join('path', 'to', 'aiAuthoringBundles', aabName);
    const agentFileName = `${aabName}.agent`;
    const agentContent = 'test agent script content';

    const createAABComponent = (): SourceComponent =>
      SourceComponent.createVirtualComponent(
        {
          name: aabName,
          type: aabType,
          xml: join(aabContentDir, `${aabName}${META_XML_SUFFIX}`),
          content: aabContentDir,
        },
        [
          {
            dirPath: join('path', 'to', 'aiAuthoringBundles'),
            children: [aabName],
          },
          {
            dirPath: aabContentDir,
            children: [agentFileName],
          },
        ]
      );
    const aabComponent = createAABComponent();
    const components = new ComponentSet([aabComponent]);

    it('should throw error with correct data when compilation fails', async () => {
      $$.SANDBOX.stub(Connection.prototype, 'retrieveMaxApiVersion').resolves('65.0');
      const connection = await testOrg.getConnection();

      const readFileStub = $$.SANDBOX.stub(fs.promises, 'readFile').resolves(agentContent);

      $$.SANDBOX.stub(connection, 'getConnectionOptions').returns({
        accessToken: 'test-access-token',
        instanceUrl: 'https://test.salesforce.com',
      });

      const compileErrors = [
        { description: 'Syntax error on line 5', lineStart: 5, colStart: 10 },
        { description: 'Missing token', lineStart: 8, colStart: 15 },
      ];

      // Configure connection.request stub (already created by TestContext)
      let callCount = 0;
      (connection.request as sinon.SinonStub).callsFake((request: { url?: string }) => {
        callCount++;
        if (request.url?.includes('agentforce/bootstrap/nameduser')) {
          return Promise.resolve({ access_token: 'named-user-token' });
        }
        if (request.url?.includes('einstein/ai-agent')) {
          return Promise.resolve({ status: 'failure' as const, errors: compileErrors });
        }
        // For other requests, return empty object (deploy stub handles its own requests)
        return Promise.resolve({});
      });

      const { operation } = await stubMetadataDeploy($$, testOrg, { components });

      try {
        await operation.start();
        expect.fail('Should have thrown AgentCompilationError');
      } catch (error: unknown) {
        const err = error as { name?: string; message?: string };
        expect(err).to.have.property('name', 'AgentCompilationError');
        expect(err.message).to.include(`${aabName}.agent: Syntax error on line 5 5:10`);
        expect(err.message).to.include(`${aabName}.agent: Missing token 8:15`);
      }

      expect(readFileStub.calledOnce).to.be.true;
      expect(callCount).to.be.at.least(2);
    });

    it('should not throw error when compilation succeeds', async () => {
      const aabComponent = createAABComponent();
      const components = new ComponentSet([aabComponent]);

      // Stub retrieveMaxApiVersion on prototype before getting connection
      $$.SANDBOX.stub(Connection.prototype, 'retrieveMaxApiVersion').resolves('60.0');
      const connection = await testOrg.getConnection();

      const readFileStub = $$.SANDBOX.stub(fs.promises, 'readFile').resolves(agentContent);

      $$.SANDBOX.stub(connection, 'getConnectionOptions').returns({
        accessToken: 'test-access-token',
        instanceUrl: 'https://test.salesforce.com',
      });

      // Configure connection.request stub (already created by TestContext)
      let callCount = 0;
      (connection.request as sinon.SinonStub).callsFake((request: { url?: string }) => {
        callCount++;
        if (request.url?.includes('agentforce/bootstrap/nameduser')) {
          return Promise.resolve({ access_token: 'named-user-token' });
        }
        if (request.url?.includes('einstein/ai-agent')) {
          return Promise.resolve({ status: 'success' as const, errors: [] });
        }
        // For other requests, return empty object (deploy stub handles its own requests)
        return Promise.resolve({});
      });

      const { operation } = await stubMetadataDeploy($$, testOrg, { components });

      // Should not throw
      await operation.start();

      expect(readFileStub.calledOnce).to.be.true;
      expect(callCount).to.be.at.least(2);
    });

    it('should not compile when no AABs present in component set', async () => {
      const components = new ComponentSet([COMPONENT]);

      // Stub retrieveMaxApiVersion on prototype before getting connection
      $$.SANDBOX.stub(Connection.prototype, 'retrieveMaxApiVersion').resolves('60.0');
      const connection = await testOrg.getConnection();

      const readFileStub = $$.SANDBOX.stub(fs.promises, 'readFile');
      // Track calls to connection.request to verify compilation wasn't attempted
      const compileCallCount = { count: 0 };
      (connection.request as sinon.SinonStub).callsFake((request: { url?: string }) => {
        const url = request.url ?? '';
        if (url.includes('einstein/ai-agent') || url.includes('agentforce/bootstrap')) {
          compileCallCount.count++;
        }
        // For other requests, return empty object (deploy stub handles its own requests)
        return Promise.resolve({});
      });

      const { operation } = await stubMetadataDeploy($$, testOrg, { components });

      await operation.start();

      // Verify compilation endpoints were not called
      expect(readFileStub.called).to.be.false;
      expect(compileCallCount.count).to.equal(0);
    });

    it('should handle multiple AABs in parallel', async () => {
      const aab1 = SourceComponent.createVirtualComponent(
        {
          name: 'AAB1',
          type: aabType,
          xml: join('path', 'to', 'aiAuthoringBundles', 'AAB1', `AAB1${META_XML_SUFFIX}`),
          content: join('path', 'to', 'aiAuthoringBundles', 'AAB1'),
        },
        [
          {
            dirPath: join('path', 'to', 'aiAuthoringBundles'),
            children: ['AAB1'],
          },
          {
            dirPath: join('path', 'to', 'aiAuthoringBundles', 'AAB1'),
            children: ['AAB1.agent'],
          },
        ]
      );

      const aab2 = SourceComponent.createVirtualComponent(
        {
          name: 'AAB2',
          type: aabType,
          xml: join('path', 'to', 'aiAuthoringBundles', 'AAB2', `AAB2${META_XML_SUFFIX}`),
          content: join('path', 'to', 'aiAuthoringBundles', 'AAB2'),
        },
        [
          {
            dirPath: join('path', 'to', 'aiAuthoringBundles'),
            children: ['AAB2'],
          },
          {
            dirPath: join('path', 'to', 'aiAuthoringBundles', 'AAB2'),
            children: ['AAB2.agent'],
          },
        ]
      );

      const components = new ComponentSet([aab1, aab2]);

      // Stub retrieveMaxApiVersion on prototype before getting connection
      $$.SANDBOX.stub(Connection.prototype, 'retrieveMaxApiVersion').resolves('60.0');
      const connection = await testOrg.getConnection();

      const readFileStub = $$.SANDBOX.stub(fs.promises, 'readFile').resolves(agentContent);

      $$.SANDBOX.stub(connection, 'getConnectionOptions').returns({
        accessToken: 'test-access-token',
        instanceUrl: 'https://test.salesforce.com',
      });

      // Configure connection.request stub (already created by TestContext)
      // Handle multiple AABs: 2 nameduser + 2 compile calls
      let namedUserCallCount = 0;
      let compileCallCount = 0;
      (connection.request as sinon.SinonStub).callsFake((request: { url?: string }) => {
        if (request.url?.includes('agentforce/bootstrap/nameduser')) {
          namedUserCallCount++;
          return Promise.resolve({ access_token: 'named-user-token' });
        }
        if (request.url?.includes('einstein/ai-agent')) {
          compileCallCount++;
          return Promise.resolve({ status: 'success' as const, errors: [] });
        }
        // For other requests, return empty object (deploy stub handles its own requests)
        return Promise.resolve({});
      });

      const { operation } = await stubMetadataDeploy($$, testOrg, { components });

      await operation.start();

      // Should read both agent files
      expect(readFileStub.callCount).to.equal(2);
      // Should call compile endpoint twice (once per AAB) and nameduser once
      expect(namedUserCallCount).to.equal(1);
      expect(compileCallCount).to.equal(2);
    });
  });
});
