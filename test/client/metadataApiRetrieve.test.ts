/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { fail } from 'assert';
import { expect } from 'chai';
import { createSandbox, match } from 'sinon';
import { join } from 'path';
import {
  RetrieveResult,
  ComponentSet,
  SourceComponent,
  ComponentStatus,
  FileResponse,
  MetadataApiRetrieveStatus,
  VirtualTreeContainer,
} from '../../src';
import { MetadataApiRetrieveError, MissingJobIdError } from '../../src/errors';
import { nls } from '../../src/i18n';
import {
  MOCK_ASYNC_RESULT,
  MOCK_DEFAULT_OUTPUT,
  stubMetadataRetrieve,
} from '../mock/client/transferOperations';
import { mockRegistry, mockRegistryData, xmlInFolder } from '../mock/registry';
import { COMPONENT } from '../mock/registry/type-constants/matchingContentFileConstants';
import { REGINA_COMPONENT } from '../mock/registry/type-constants/reginaConstants';
import { getString } from '@salesforce/ts-types';
import { fs } from '@salesforce/core';

const env = createSandbox();

describe('MetadataApiRetrieve', async () => {
  afterEach(() => env.restore());

  describe('Lifecycle', () => {
    describe('start', () => {
      it('should throw error if there are no components to retrieve', async () => {
        const toRetrieve = new ComponentSet([], mockRegistry);
        const { operation } = await stubMetadataRetrieve(env, {
          toRetrieve: toRetrieve,
          merge: true,
        });

        try {
          await operation.start();
          fail('should have thrown an error');
        } catch (e) {
          expect(e.name).to.equal(MetadataApiRetrieveError.name);
          expect(e.message).to.equal(nls.localize('error_no_components_to_retrieve'));
        }
      });

      it('should throw error if packageNames list is empty', async () => {
        const toRetrieve = new ComponentSet([], mockRegistry);
        const { operation } = await stubMetadataRetrieve(env, {
          toRetrieve: toRetrieve,
          merge: true,
          packageOptions: [],
        });

        try {
          await operation.start();
          fail('should have thrown an error');
        } catch (e) {
          expect(e.name).to.equal(MetadataApiRetrieveError.name);
          expect(e.message).to.equal(nls.localize('error_no_components_to_retrieve'));
        }
      });

      it('should call retrieve for unpackaged data', async () => {
        const toRetrieve = new ComponentSet([COMPONENT], mockRegistry);
        const options = {
          toRetrieve,
          merge: true,
          successes: toRetrieve,
        };
        const { operation, retrieveStub } = await stubMetadataRetrieve(env, options);
        await operation.start();

        expect(retrieveStub.calledOnce).to.be.true;
        expect(retrieveStub.firstCall.args[0]).to.deep.equal({
          apiVersion: toRetrieve.apiVersion,
          unpackaged: toRetrieve.getObject().Package,
        });
      });

      it('should call retrieve for a package as string[]', async () => {
        const toRetrieve = new ComponentSet([COMPONENT], mockRegistry);
        const options = {
          toRetrieve,
          packageOptions: ['MyPackage'],
          merge: true,
          successes: toRetrieve,
        };
        const { operation, retrieveStub } = await stubMetadataRetrieve(env, options);
        await operation.start();

        expect(retrieveStub.calledOnce).to.be.true;
        expect(retrieveStub.firstCall.args[0]).to.deep.equal({
          apiVersion: toRetrieve.apiVersion,
          packageNames: options.packageOptions,
          unpackaged: toRetrieve.getObject().Package,
        });
      });

      it('should call retrieve for a package as PackageOptions[] with name only', async () => {
        const toRetrieve = new ComponentSet([COMPONENT], mockRegistry);
        const options = {
          toRetrieve,
          packageOptions: [{ name: 'MyPackage' }],
          merge: true,
          successes: toRetrieve,
        };
        const { operation, retrieveStub } = await stubMetadataRetrieve(env, options);
        await operation.start();

        expect(retrieveStub.calledOnce).to.be.true;
        expect(retrieveStub.firstCall.args[0]).to.deep.equal({
          apiVersion: toRetrieve.apiVersion,
          packageNames: [options.packageOptions[0].name],
          unpackaged: toRetrieve.getObject().Package,
        });
      });

      it('should call retrieve for a package as PackageOptions[] with name and outputDir', async () => {
        const toRetrieve = new ComponentSet([COMPONENT], mockRegistry);
        const options = {
          toRetrieve,
          packageOptions: [{ name: 'MyPackage', outputDir: 'fake/output/dir' }],
          merge: true,
          successes: toRetrieve,
        };
        const { operation, retrieveStub } = await stubMetadataRetrieve(env, options);
        await operation.start();

        expect(retrieveStub.calledOnce).to.be.true;
        expect(retrieveStub.firstCall.args[0]).to.deep.equal({
          apiVersion: toRetrieve.apiVersion,
          packageNames: [options.packageOptions[0].name],
          unpackaged: toRetrieve.getObject().Package,
        });
      });

      it('should return an AsyncResult', async () => {
        const toRetrieve = new ComponentSet([COMPONENT], mockRegistry);
        const options = {
          toRetrieve,
          packageNames: ['MyPackage'],
          merge: true,
          successes: toRetrieve,
        };
        const { operation } = await stubMetadataRetrieve(env, options);

        const result = await operation.start();

        expect(result).to.deep.equal(MOCK_ASYNC_RESULT);
      });

      it('should set the retrieve ID', async () => {
        const toRetrieve = new ComponentSet([COMPONENT], mockRegistry);
        const options = {
          toRetrieve,
          packageNames: ['MyPackage'],
          merge: true,
          successes: toRetrieve,
        };
        const { operation, response } = await stubMetadataRetrieve(env, options);

        await operation.start();

        expect(operation.id).to.deep.equal(response.id);
      });
    });

    describe('pollStatus', () => {
      const getPackageComponent = (packageName: string): SourceComponent => {
        const contentName = 'z.mcf';
        const metaName = `${contentName}-meta.xml`;
        const type = mockRegistryData.types.matchingcontentfile;
        return new SourceComponent(
          {
            name: 'z',
            type,
            xml: join(packageName, type.directoryName, metaName),
            content: join(packageName, type.directoryName, contentName),
          },
          new VirtualTreeContainer([
            {
              dirPath: join(packageName, type.directoryName),
              children: [metaName, contentName],
            },
          ])
        );
      };

      it('should retrieve zip and extract to directory', async () => {
        const component = COMPONENT;
        const toRetrieve = new ComponentSet([component], mockRegistry);
        const { operation, convertStub } = await stubMetadataRetrieve(env, {
          toRetrieve,
          successes: toRetrieve,
        });

        await operation.start();
        await operation.pollStatus();

        expect(convertStub.calledOnce).to.be.true;
        expect(
          convertStub.calledWith(match.any, 'source', {
            type: 'directory',
            outputDirectory: MOCK_DEFAULT_OUTPUT,
          })
        ).to.be.true;
      });

      it('should retrieve zip with packages and extract to default directory', async () => {
        const component = COMPONENT;
        const packageName = 'MyPackage';
        const pkgComponent = getPackageComponent(packageName);
        const fromSourceSpy = env.spy(ComponentSet, 'fromSource');
        const toRetrieve = new ComponentSet([component], mockRegistry);
        const successesCompSet = new ComponentSet([component, pkgComponent], mockRegistry);
        const { operation, convertStub } = await stubMetadataRetrieve(env, {
          toRetrieve,
          packageOptions: [packageName],
          successes: successesCompSet,
        });

        await operation.start();
        await operation.pollStatus();

        expect(convertStub.calledTwice).to.be.true;
        const convertCall1Args = convertStub.firstCall.args;
        const convertCall2Args = convertStub.secondCall.args;
        expect(convertCall1Args[1]).to.equal('source');
        expect(convertCall1Args[2]).to.deep.equal({
          type: 'directory',
          outputDirectory: MOCK_DEFAULT_OUTPUT,
        });
        expect(fromSourceSpy.calledTwice).to.be.true;
        expect(fromSourceSpy.secondCall.args[0]).to.have.deep.property('fsPaths', [packageName]);
        expect(convertCall2Args[1]).to.equal('source');
        expect(convertCall2Args[2]).to.deep.equal({
          type: 'directory',
          outputDirectory: packageName,
        });
      });

      it('should retrieve zip with packages and extract to specified directory', async () => {
        const component = COMPONENT;
        const packageName = 'MyPackage';
        const packageOutputDir = 'myPackageDir';
        const pkgComponent = getPackageComponent(packageName);
        const fromSourceSpy = env.spy(ComponentSet, 'fromSource');
        const toRetrieve = new ComponentSet([component], mockRegistry);
        const successesCompSet = new ComponentSet([component, pkgComponent], mockRegistry);
        const { operation, convertStub } = await stubMetadataRetrieve(env, {
          toRetrieve,
          packageOptions: [{ name: packageName, outputDir: packageOutputDir }],
          successes: successesCompSet,
        });

        await operation.start();
        await operation.pollStatus();

        expect(convertStub.calledTwice).to.be.true;
        const convertCall1Args = convertStub.firstCall.args;
        const convertCall2Args = convertStub.secondCall.args;
        expect(convertCall1Args[1]).to.equal('source');
        expect(convertCall1Args[2]).to.deep.equal({
          type: 'directory',
          outputDirectory: MOCK_DEFAULT_OUTPUT,
        });
        expect(fromSourceSpy.calledTwice).to.be.true;
        expect(fromSourceSpy.secondCall.args[0]).to.have.deep.property('fsPaths', [packageName]);
        expect(convertCall2Args[1]).to.equal('source');
        expect(convertCall2Args[2]).to.deep.equal({
          type: 'directory',
          outputDirectory: packageOutputDir,
        });
      });

      it('should save the temp directory if the environment variable is set', async () => {
        try {
          process.env.SFDX_MDAPI_TEMP_DIR = 'test';
          const toRetrieve = new ComponentSet([COMPONENT], mockRegistry);
          const { operation, convertStub } = await stubMetadataRetrieve(env, {
            toRetrieve,
            merge: true,
            successes: toRetrieve,
          });
          env.stub(fs, 'writeFileSync');

          await operation.start();
          await operation.pollStatus();

          expect(getString(convertStub.secondCall.args[2], 'outputDirectory', '')).to.equal('test');
        } finally {
          delete process.env.SFDX_MDAPI_TEMP_DIR;
        }
      });

      it('should NOT save the temp directory if the environment variable is NOT set', async () => {
        const toRetrieve = new ComponentSet([COMPONENT], mockRegistry);
        const { operation, convertStub } = await stubMetadataRetrieve(env, {
          toRetrieve,
          merge: true,
          successes: toRetrieve,
        });
        env.stub(fs, 'writeFileSync');

        await operation.start();
        await operation.pollStatus();
        // if the env var is set the callCount will be 2
        expect(convertStub.callCount).to.equal(1);
      });

      it('should retrieve zip and merge with existing components', async () => {
        const component = COMPONENT;
        const toRetrieve = new ComponentSet([component], mockRegistry);
        const { operation, convertStub } = await stubMetadataRetrieve(env, {
          toRetrieve,
          merge: true,
          successes: toRetrieve,
        });

        await operation.start();
        await operation.pollStatus();

        expect(convertStub.calledOnce).to.be.true;
        expect(
          convertStub.calledWith(match.any, 'source', {
            type: 'merge',
            mergeWith: toRetrieve.getSourceComponents(),
            defaultDirectory: MOCK_DEFAULT_OUTPUT,
          })
        ).to.be.true;
      });

      it('should construct a result object with retrieved components', async () => {
        const toRetrieve = new ComponentSet([COMPONENT], mockRegistry);
        const { operation, response } = await stubMetadataRetrieve(env, {
          toRetrieve,
          merge: true,
          successes: toRetrieve,
        });

        await operation.start();
        const result = await operation.pollStatus();
        const expected = new RetrieveResult(response, toRetrieve);

        expect(result).to.deep.equal(expected);
      });

      it('should construct a result object with no components when no components are retrieved', async () => {
        const toRetrieve = new ComponentSet([COMPONENT], mockRegistry);
        const { operation, response } = await stubMetadataRetrieve(env, {
          toRetrieve,
          merge: true,
          messages: [
            {
              problem: 'whoops!',
            },
          ],
        });

        await operation.start();
        const result = await operation.pollStatus();
        const expected = new RetrieveResult(response, new ComponentSet(undefined, mockRegistry));

        expect(result).to.deep.equal(expected);
      });
    });
  });

  describe('checkStatus', () => {
    it('should throw an error when attempting to call checkStatus without an id set', async () => {
      const toRetrieve = new ComponentSet([COMPONENT], mockRegistry);
      const { operation } = await stubMetadataRetrieve(env, {
        toRetrieve,
        merge: true,
      });
      try {
        await operation.checkStatus();
        chai.assert.fail('the above should throw an error');
      } catch (e) {
        const expectedError = new MissingJobIdError('retrieve');
        expect(e.name).to.equal(expectedError.name);
        expect(e.message).to.equal(expectedError.message);
      }
    });
  });

  describe('cancel', () => {
    it('should immediately stop polling', async () => {
      const component = COMPONENT;
      const components = new ComponentSet([component], mockRegistry);
      const { operation, checkStatusStub } = await stubMetadataRetrieve(env, {
        toRetrieve: components,
      });

      await operation.start();
      const operationPromise = operation.pollStatus();
      await operation.cancel();
      await operationPromise;

      expect(checkStatusStub.notCalled).to.be.true;
    });
  });

  describe('RetrieveResult', () => {
    describe('getFileResponses', () => {
      it('should report all files of a component on success', () => {
        const component = COMPONENT;
        const retrievedSet = new ComponentSet([component]);
        const apiStatus = {};
        const result = new RetrieveResult(apiStatus as MetadataApiRetrieveStatus, retrievedSet);

        const responses = result.getFileResponses();
        const baseResponse: FileResponse = {
          state: ComponentStatus.Changed,
          fullName: component.fullName,
          type: component.type.name,
        };
        const expected: FileResponse[] = [
          Object.assign({}, baseResponse, { filePath: component.content }),
          Object.assign({}, baseResponse, { filePath: component.xml }),
        ];

        expect(responses).to.deep.equal(expected);
      });
    });

    it('should report one failure if component does not exist', () => {
      const component = COMPONENT;
      const retrievedSet = new ComponentSet();
      const apiStatus = {
        messages: [
          {
            problem: `Entity of type '${component.type.name}' named '${component.fullName}' cannot be found`,
          },
        ],
      };
      const result = new RetrieveResult(apiStatus as MetadataApiRetrieveStatus, retrievedSet);

      const responses = result.getFileResponses();
      const expected: FileResponse[] = [
        {
          state: ComponentStatus.Failed,
          error: apiStatus.messages[0].problem,
          fullName: component.fullName,
          type: component.type.name,
          problemType: 'Error',
        },
      ];

      expect(responses).to.deep.equal(expected);
    });

    it('should report files of successful component and one failure for an unsuccessful one', () => {
      const successComponent = xmlInFolder.COMPONENTS[0];
      const failComponent = COMPONENT;
      const retrievedSet = new ComponentSet([successComponent]);
      const apiStatus = {
        messages: [
          {
            problem: `Entity of type '${failComponent.type.name}' named '${failComponent.fullName}' cannot be found`,
          },
        ],
      };
      const result = new RetrieveResult(apiStatus as MetadataApiRetrieveStatus, retrievedSet);

      const responses = result.getFileResponses();
      const expected: FileResponse[] = [
        {
          state: ComponentStatus.Failed,
          error: apiStatus.messages[0].problem,
          fullName: failComponent.fullName,
          type: failComponent.type.name,
          problemType: 'Error',
        },
        {
          state: ComponentStatus.Changed,
          fullName: successComponent.fullName,
          type: successComponent.type.name,
          filePath: successComponent.xml,
        },
      ];

      expect(responses).to.deep.equal(expected);
    });

    it('should report unexpected failure message', () => {
      const retrievedSet = new ComponentSet();
      const apiStatus = {
        messages: [
          {
            problem: '\\_(ツ)_/¯ not sure what happened',
          },
        ],
      };
      const result = new RetrieveResult(apiStatus as MetadataApiRetrieveStatus, retrievedSet);

      const responses = result.getFileResponses();
      const expected: FileResponse[] = [
        {
          state: ComponentStatus.Failed,
          error: apiStatus.messages[0].problem,
          fullName: '',
          type: '',
          problemType: 'Error',
        },
      ];

      expect(responses).to.deep.equal(expected);
    });

    /**
     * This is tested on the assumption that the ComponentWriter result directly
     * includes children in the returned set, so we don't need to eagrly resolve
     * the children of a parent.
     */
    it('should not report content files if component type has children', () => {
      const component = REGINA_COMPONENT;
      const retrievedSet = new ComponentSet([component]);
      const apiStatus = {};
      const result = new RetrieveResult(apiStatus as MetadataApiRetrieveStatus, retrievedSet);

      const responses = result.getFileResponses();
      const expected: FileResponse[] = [
        {
          state: ComponentStatus.Changed,
          fullName: component.fullName,
          type: component.type.name,
          filePath: component.xml,
        },
      ];

      expect(responses).to.deep.equal(expected);
    });

    it('should only report xml file if the component has one', () => {
      const component = new SourceComponent(
        {
          name: 'OnlyContent',
          type: mockRegistryData.types.matchingcontentfile,
          content: COMPONENT.content,
        },
        COMPONENT.tree
      );
      const retrievedSet = new ComponentSet([component]);
      const apiStatus = {};
      const result = new RetrieveResult(apiStatus as MetadataApiRetrieveStatus, retrievedSet);

      const responses = result.getFileResponses();
      const expected: FileResponse[] = [
        {
          state: ComponentStatus.Changed,
          fullName: component.fullName,
          type: component.type.name,
          filePath: component.content,
        },
      ];

      expect(responses).to.deep.equal(expected);
    });
  });
});
