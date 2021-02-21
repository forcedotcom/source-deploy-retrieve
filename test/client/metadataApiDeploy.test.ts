/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { createSandbox } from 'sinon';
import { ComponentSet, registryData, SourceComponent } from '../../src';
import {
  ComponentStatus,
  DeployMessage,
  FileResponse,
  MetadataApiDeployStatus,
  RequestStatus,
} from '../../src/client/types';
import { expect } from 'chai';
import { KEANU_COMPONENT } from '../mock/registry/keanuConstants';
import { basename, join } from 'path';
import { MOCK_ASYNC_RESULT, stubMetadataDeploy } from '../mock/client/transferOperations';
import { DeployResult } from '../../src/client/metadataApiDeploy';

const env = createSandbox();

describe('MetadataApiDeploy', () => {
  afterEach(() => env.restore());

  describe('Lifecycle', () => {
    it('should convert to metadata format and create zip', () => {});

    it('should call deploy with zip', () => {});

    it('should construct a result object with deployed components', () => {});

    it('should cancel immediately if cancelDeploy call returns done = true', async () => {
      const { operation, checkStatusStub, invokeStub } = await stubMetadataDeploy(env);
      invokeStub.withArgs('cancelDeploy', { id: MOCK_ASYNC_RESULT.id }).returns({ done: true });

      operation.cancel();
      await operation.start();

      expect(checkStatusStub.notCalled).to.be.true;
    });

    it('should async cancel if cancelDeploy call returns done = false', async () => {
      const { operation, checkStatusStub, invokeStub } = await stubMetadataDeploy(env);
      invokeStub.withArgs('cancelDeploy', { id: MOCK_ASYNC_RESULT.id }).returns({ done: false });
      checkStatusStub
        .withArgs(MOCK_ASYNC_RESULT.id, true)
        .resolves({ status: RequestStatus.Canceled });

      operation.cancel();
      await operation.start();

      expect(checkStatusStub.calledOnce).to.be.true;
    });
  });

  describe('DeployResult', () => {
    describe('getFileResponses', () => {
      it('should set "Changed" component status for changed component', async () => {
        const component = KEANU_COMPONENT;
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
            fullName: fullName,
            type: type.name,
            state: ComponentStatus.Changed,
            filePath: content,
          },
          {
            fullName: fullName,
            type: type.name,
            state: ComponentStatus.Changed,
            filePath: xml,
          },
        ];

        expect(responses).to.deep.equal(expected);
      });

      it('should set "Created" component status for changed component', async () => {
        const component = KEANU_COMPONENT;
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
            fullName: fullName,
            type: type.name,
            state: ComponentStatus.Created,
            filePath: content,
          },
          {
            fullName: fullName,
            type: type.name,
            state: ComponentStatus.Created,
            filePath: xml,
          },
        ];

        expect(responses).to.deep.equal(expected);
      });

      it('should set "Deleted" component status for deleted component', async () => {
        const component = KEANU_COMPONENT;
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
            fullName: fullName,
            type: type.name,
            state: ComponentStatus.Deleted,
            filePath: content,
          },
          {
            fullName: fullName,
            type: type.name,
            state: ComponentStatus.Deleted,
            filePath: xml,
          },
        ];

        expect(responses).to.deep.equal(expected);
      });

      it('should set "Failed" component status for failed component', async () => {
        const component = KEANU_COMPONENT;
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
            fullName: fullName,
            type: type.name,
            state: ComponentStatus.Failed,
            filePath: content,
            error: problem,
            problemType,
          },
        ];

        expect(responses).to.deep.equal(expected);
      });

      it('should set "Unchanged" component status for an unchanged component', async () => {
        const component = KEANU_COMPONENT;
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
            fullName: fullName,
            type: type.name,
            state: ComponentStatus.Unchanged,
            filePath: content,
          },
          {
            fullName: fullName,
            type: type.name,
            state: ComponentStatus.Unchanged,
            filePath: xml,
          },
        ];

        expect(responses).to.deep.equal(expected);
      });

      it('should aggregate diagnostics for a component', () => {
        const component = KEANU_COMPONENT;
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
            fullName: fullName,
            type: type.name,
            state: ComponentStatus.Failed,
            filePath: content,
            error: `${problem} (3:5)`,
            lineNumber: 3,
            columnNumber: 5,
            problemType,
          },
          {
            fullName: fullName,
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

      it('should report children of deployed component', () => {});

      describe('Sanitizing deploy messages', () => {
        it('should fix deploy message issue for "LightningComponentBundle" type', () => {
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
          const deployedSet = new ComponentSet([component]);
          const { fullName, type, xml } = component;
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
            .map((f) => {
              return {
                fullName: fullName,
                type: type.name,
                state: ComponentStatus.Changed,
                filePath: f,
              };
            })
            .concat({
              fullName: fullName,
              type: type.name,
              state: ComponentStatus.Changed,
              filePath: xml,
            }) as FileResponse[];

          expect(responses).to.deep.equal(expected);
        });

        it('should fix deploy message issue for "Document" type', () => {});
      });
    });
  });
});
