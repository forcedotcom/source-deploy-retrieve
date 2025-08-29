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
import { fail } from 'node:assert';
import { join, sep } from 'node:path';
import { Messages } from '@salesforce/core';
import { assert, expect } from 'chai';
import * as chai from 'chai';
import deepEqualInAnyOrder from 'deep-equal-in-any-order';
import { SinonStub } from 'sinon';
import { ensureString, getString } from '@salesforce/ts-types';
import fs from 'graceful-fs';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import {
  ComponentSet,
  ComponentStatus,
  FileResponse,
  MetadataApiRetrieve,
  MetadataApiRetrieveStatus,
  registry,
  RequestStatus,
  RetrieveResult,
  SourceComponent,
  VirtualTreeContainer,
} from '../../src';
import { MOCK_ASYNC_RESULT, MOCK_DEFAULT_OUTPUT, stubMetadataRetrieve } from '../mock/client/transferOperations';
import { xmlInFolder } from '../mock';
import { COMPONENT } from '../mock/type-constants/apexClassConstant';
import { DECOMPOSED_COMPONENT } from '../mock/type-constants/customObjectConstant';
import * as coverage from '../../src/registry/coverage';
import { testApiVersion } from '../mock/manifestConstants';
import * as extractForStub from '../../src/client/retrieveExtract';

chai.use(deepEqualInAnyOrder);

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

describe('MetadataApiRetrieve', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();

  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    $$.SANDBOX.stub(coverage, 'getCurrentApiVersion').resolves(testApiVersion);
  });

  describe('Lifecycle', () => {
    describe('start', () => {
      const expectedError = {
        name: 'MetadataApiRetrieveError',
        message: messages.getMessage('error_no_components_to_retrieve'),
      };
      it('should throw error if there are no components to retrieve', async () => {
        const toRetrieve = new ComponentSet([]);
        const { operation } = await stubMetadataRetrieve($$, testOrg, {
          toRetrieve,
          merge: true,
        });

        try {
          await operation.start();
          fail('should have thrown an error');
        } catch (e) {
          assert(e instanceof Error);
          expect(e.name).to.equal(expectedError.name);
          expect(e.message).to.equal(expectedError.message);
        }
      });

      it('should throw error if packageNames list is empty', async () => {
        const toRetrieve = new ComponentSet([]);
        const { operation } = await stubMetadataRetrieve($$, testOrg, {
          toRetrieve,
          merge: true,
          packageOptions: [],
        });

        try {
          await operation.start();
          fail('should have thrown an error');
        } catch (e) {
          assert(e instanceof Error);
          expect(e.name).to.equal(expectedError.name);
          expect(e.message).to.equal(expectedError.message);
        }
      });

      it('should call retrieve for unpackaged data', async () => {
        const toRetrieve = new ComponentSet([COMPONENT]);
        const options = {
          toRetrieve,
          merge: true,
          successes: toRetrieve,
        };
        const { operation, retrieveStub } = await stubMetadataRetrieve($$, testOrg, options);
        await operation.start();

        expect(retrieveStub.calledOnce).to.be.true;
        expect(retrieveStub.firstCall.args[0]).to.deep.equal({
          apiVersion: (await testOrg.getConnection()).getApiVersion(),
          unpackaged: (await toRetrieve.getObject()).Package,
        });
      });

      it('should call retrieve for a package as string[]', async () => {
        const toRetrieve = new ComponentSet([COMPONENT]);
        const options = {
          toRetrieve,
          packageOptions: ['MyPackage'],
          merge: true,
          successes: toRetrieve,
        };
        const { operation, retrieveStub } = await stubMetadataRetrieve($$, testOrg, options);
        await operation.start();

        expect(retrieveStub.calledOnce).to.be.true;
        expect(retrieveStub.firstCall.args[0]).to.deep.equal({
          apiVersion: (await testOrg.getConnection()).getApiVersion(),
          packageNames: options.packageOptions,
          unpackaged: (await toRetrieve.getObject()).Package,
        });
      });

      it('should call retrieve for a package as PackageOptions[] with name only', async () => {
        const toRetrieve = new ComponentSet([COMPONENT]);
        const options = {
          toRetrieve,
          packageOptions: [{ name: 'MyPackage' }],
          merge: true,
          successes: toRetrieve,
        };
        const { operation, retrieveStub } = await stubMetadataRetrieve($$, testOrg, options);
        await operation.start();

        expect(retrieveStub.calledOnce).to.be.true;
        expect(retrieveStub.firstCall.args[0]).to.deep.equal({
          apiVersion: (await testOrg.getConnection()).getApiVersion(),
          packageNames: [options.packageOptions[0].name],
          unpackaged: (await toRetrieve.getObject()).Package,
        });
      });

      it('should call retrieve for a package as PackageOptions[] with name and outputDir', async () => {
        const toRetrieve = new ComponentSet([COMPONENT]);
        const options = {
          toRetrieve,
          packageOptions: [{ name: 'MyPackage', outputDir: 'fake/output/dir' }],
          merge: true,
          successes: toRetrieve,
        };
        const { operation, retrieveStub } = await stubMetadataRetrieve($$, testOrg, options);
        await operation.start();

        expect(retrieveStub.calledOnce).to.be.true;
        expect(retrieveStub.firstCall.args[0]).to.deep.equal({
          apiVersion: (await testOrg.getConnection()).getApiVersion(),
          packageNames: [options.packageOptions[0].name],
          unpackaged: (await toRetrieve.getObject()).Package,
        });
      });

      it('should call retrieve with rootTypesWithDependencies', async () => {
        const toRetrieve = new ComponentSet([COMPONENT]);
        const options = {
          toRetrieve,
          rootTypesWithDependencies: [ 'Bot' ],
          merge: true,
          successes: toRetrieve,
        };
        const { operation, retrieveStub } = await stubMetadataRetrieve($$, testOrg, options);
        await operation.start();

        expect(retrieveStub.calledOnce).to.be.true;
        expect(retrieveStub.firstCall.args[0]).to.deep.equal({
          apiVersion: (await testOrg.getConnection()).getApiVersion(),
          rootTypesWithDependencies: options.rootTypesWithDependencies,
          unpackaged: (await toRetrieve.getObject()).Package,
        });
      });

      it('should return an AsyncResult', async () => {
        const toRetrieve = new ComponentSet([COMPONENT]);
        const options = {
          toRetrieve,
          packageNames: ['MyPackage'],
          merge: true,
          successes: toRetrieve,
        };
        const { operation } = await stubMetadataRetrieve($$, testOrg, options);

        const result = await operation.start();

        expect(result).to.deep.equal(MOCK_ASYNC_RESULT);
      });

      it('should set the retrieve ID', async () => {
        const toRetrieve = new ComponentSet([COMPONENT]);
        const options = {
          toRetrieve,
          packageNames: ['MyPackage'],
          merge: true,
          successes: toRetrieve,
        };
        const { operation, response } = await stubMetadataRetrieve($$, testOrg, options);

        await operation.start();

        expect(operation.id).to.deep.equal(response.id);
      });
    });

    describe('pollStatus', () => {
      const getPackageComponent = (packageName: string): SourceComponent => {
        const contentName = 'z.mcf';
        const metaName = `${contentName}-meta.xml`;
        const type = registry.types.apexclass;
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
        const toRetrieve = new ComponentSet([component]);
        const { operation, convertStub } = await stubMetadataRetrieve($$, testOrg, {
          toRetrieve,
          successes: toRetrieve,
        });

        await operation.start();
        await operation.pollStatus();

        expect(convertStub.calledOnce).to.be.true;
        expect(convertStub.firstCall.args).to.deep.equal([
          [],
          'source',
          { type: 'directory', outputDirectory: MOCK_DEFAULT_OUTPUT },
        ]);
      });

      it('should retrieve zip with packages and extract to default directory', async () => {
        const component = COMPONENT;
        const packageName = 'MyPackage';
        const pkgComponent = getPackageComponent(packageName);
        const fromSourceSpy = $$.SANDBOX.spy(ComponentSet, 'fromSource');
        const toRetrieve = new ComponentSet([component]);
        const successesCompSet = new ComponentSet([component, pkgComponent]);
        const { operation, convertStub } = await stubMetadataRetrieve($$, testOrg, {
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
        const fromSourceSpy = $$.SANDBOX.spy(ComponentSet, 'fromSource');
        const toRetrieve = new ComponentSet([component]);
        const successesCompSet = new ComponentSet([component, pkgComponent]);
        const { operation, convertStub } = await stubMetadataRetrieve($$, testOrg, {
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
          process.env.SF_MDAPI_TEMP_DIR = 'test';
          const toRetrieve = new ComponentSet([COMPONENT]);
          const { operation, convertStub } = await stubMetadataRetrieve($$, testOrg, {
            toRetrieve,
            merge: true,
            successes: toRetrieve,
          });
          $$.SANDBOX.stub(fs.promises, 'writeFile');
          $$.SANDBOX.stub(fs, 'mkdirSync');
          $$.SANDBOX.stub(fs, 'writeFileSync');

          await operation.start();
          await operation.pollStatus();

          // @ts-expect-error protected property
          const expectedDir = join(operation.mdapiTempDir, 'source');
          expect(expectedDir.startsWith(`test${sep}`)).to.be.true;
          expect(getString(convertStub.secondCall.args[2], 'outputDirectory', '')).to.equal(expectedDir);
        } finally {
          delete process.env.SF_MDAPI_TEMP_DIR;
        }
      });

      it('should NOT save the temp directory if the environment variable is NOT set', async () => {
        const toRetrieve = new ComponentSet([COMPONENT]);
        const { operation, convertStub } = await stubMetadataRetrieve($$, testOrg, {
          toRetrieve,
          merge: true,
          successes: toRetrieve,
        });
        $$.SANDBOX.stub(fs, 'writeFileSync');

        await operation.start();
        await operation.pollStatus();
        // if the $$.SANDBOX var is set the callCount will be 2
        expect(convertStub.callCount).to.equal(1);
      });

      it('should retrieve zip and merge with existing components', async () => {
        const component = COMPONENT;
        const toRetrieve = new ComponentSet([component]);
        const { operation, convertStub } = await stubMetadataRetrieve($$, testOrg, {
          toRetrieve,
          merge: true,
          successes: toRetrieve,
        });

        await operation.start();
        await operation.pollStatus();

        expect(convertStub.calledOnce).to.be.true;
        expect(convertStub.firstCall.args).to.deep.equal([
          [],
          'source',
          {
            type: 'merge',
            mergeWith: toRetrieve.getSourceComponents(),
            defaultDirectory: MOCK_DEFAULT_OUTPUT,
            forceIgnoredPaths: new Set<string>(),
          },
        ]);
      });

      it('should construct a result object with retrieved components', async () => {
        const toRetrieve = new ComponentSet([COMPONENT]);
        const { operation, response } = await stubMetadataRetrieve($$, testOrg, {
          toRetrieve,
          merge: true,
          successes: toRetrieve,
        });

        await operation.start();
        const result = await operation.pollStatus();
        const expected = new RetrieveResult(response, toRetrieve, toRetrieve);
        expect(result.response).to.deep.equalInAnyOrder(expected.response);
        expect(result.components.toArray()).to.deep.equalInAnyOrder(expected.components.toArray());
      });

      it('should construct a result object with no components when components are forceIgnored', async () => {
        const toRetrieve = new ComponentSet([COMPONENT]);
        assert(COMPONENT.xml);
        assert(COMPONENT.content);
        toRetrieve.forceIgnoredPaths = new Set([COMPONENT.xml, COMPONENT.content]);
        const { operation } = await stubMetadataRetrieve($$, testOrg, {
          toRetrieve,
          merge: true,
          successes: toRetrieve,
        });

        await operation.start();
        const result = await operation.pollStatus();

        expect(result.components.size).to.equal(0);
      });

      it('should construct a result object with no components when no components are retrieved', async () => {
        const toRetrieve = new ComponentSet([COMPONENT]);
        const { operation, response } = await stubMetadataRetrieve($$, testOrg, {
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
        const compSet = new ComponentSet(undefined);
        const expected = new RetrieveResult(response, compSet, toRetrieve);

        expect(result).to.deep.equal(expected);
      });
    });
  });

  describe('checkStatus', () => {
    it('should throw an error when attempting to call checkStatus without an id set', async () => {
      const toRetrieve = new ComponentSet([COMPONENT]);
      const { operation } = await stubMetadataRetrieve($$, testOrg, {
        toRetrieve,
        merge: true,
      });
      try {
        await operation.checkStatus();
        chai.assert.fail('the above should throw an error');
      } catch (e) {
        const expectedError = {
          name: 'MissingJobIdError',
          message: messages.getMessage('error_no_job_id', ['retrieve']),
        };
        assert(e instanceof Error);

        expect(e.name).to.equal(expectedError.name);
        expect(e.message).to.equal(expectedError.message);
      }
    });
  });

  describe('post', () => {
    const output = join('mdapi', 'retrieve', 'dir');
    const format = 'metadata';
    // This is what real zip file contents look like from the server
    const zipFile = `UEsDBBQACAgIACKPFlcAAAAAAAAAAAAAAAAiAAAAdW5wYWNrYWdlZC9jbGFzc2VzL1BhZ2VkUmVzdWx
0LmNsc53MsQoCMQwG4P2eIu/hoojDLSo6ikPahl6l15Ym4cDj3t2qm5Oa4efnhy9FTQwWpiAD8IA1JA82IjMc0ZM7EWsUmDtot95
oxV1CE8m9hvLGfRLyVKE0cQ53ghk8yQr4GUv3td3raFr9Q0sWjL3QuM2a5JcPB3MjK5crVLK5Ov6wywNQSwcIZ6ozvYIAAAAgAQA
AUEsDBBQACAgIACKPFlcAAAAAAAAAAAAAAAArAAAAdW5wYWNrYWdlZC9jbGFzc2VzL1BhZ2VkUmVzdWx0LmNscy1tZXRhLnhtbE2
NQQrCMBBF9zlFyN5MFJUiaUoRPIG6H9KogTYJnbH0+BYq4t+9z4Nnm3no5RRGijnVaquNkiH53MX0rNXtetlUqnHCtiXM5x6J5OI
nqtWLuZwAKGPR9MijD9rnAXbGHMHsYQiMHTIqJ+QyiyXe14g7VNpY+DtWgxj5Ta71HKdg4YvCwi/txAdQSwcIwX3rpIgAAACuAAA
AUEsDBBQACAgIACKPFlcAAAAAAAAAAAAAAAAWAAAAdW5wYWNrYWdlZC9wYWNrYWdlLnhtbE2OywrCMBBF9/2KkL2ZKCpF0hQRXBf
RD4jpWIvNgyZK/XtDa9FZzRkuZ64oB9ORF/ahdbagS8YpQatd3dqmoJfzcZHTUmaiUvqhGiQpbUNB7zH6HUBwyrNwc71Gpp2BFed
b4GswGFWtoqIyI2lEfHsM0z6yQXNNL2WVlPUJw7OLAubjL2aVQbn3OBw6FYKAkScj/CnFt77c5IwLmCkT8G0tsw9QSwcIAYbHtaM
AAADnAAAAUEsBAhQAFAAICAgAIo8WV2eqM72CAAAAIAEAACIAAAAAAAAAAAAAAAAAAAAAAHVucGFja2FnZWQvY2xhc3Nlcy9QYWd
lZFJlc3VsdC5jbHNQSwECFAAUAAgICAAijxZXwX3rpIgAAACuAAAAKwAAAAAAAAAAAAAAAADSAAAAdW5wYWNrYWdlZC9jbGFzc2V
zL1BhZ2VkUmVzdWx0LmNscy1tZXRhLnhtbFBLAQIUABQACAgIACKPFlcBhse1owAAAOcAAAAWAAAAAAAAAAAAAAAAALMBAAB1bnB
hY2thZ2VkL3BhY2thZ2UueG1sUEsFBgAAAAADAAMA7QAAAJoCAAAAAA==`;
    const zipFileContents = Buffer.from(zipFile, 'base64');
    const usernameOrConnection = 'retrieve@test.org';
    const fakeResults = { status: RequestStatus.Succeeded, zipFile } as MetadataApiRetrieveStatus;
    let writeFileStub: SinonStub;
    let mkdirStub: SinonStub;
    let mdapiRetrieveExtractStub: SinonStub;

    beforeEach(() => {
      writeFileStub = $$.SANDBOX.stub(fs, 'writeFileSync');
      mkdirStub = $$.SANDBOX.stub(fs, 'mkdirSync');
    });

    it('should write the retrieved zip when format=metadata', async () => {
      mdapiRetrieveExtractStub = $$.SANDBOX.stub(extractForStub, 'extract').throws();

      const mdapiRetrieve = new MetadataApiRetrieve({ usernameOrConnection, output, format });
      await mdapiRetrieve.post(fakeResults);

      expect(writeFileStub.calledOnce).to.be.true;
      expect(writeFileStub.firstCall.args[0]).to.equal(join(output, 'unpackaged.zip'));
      expect(writeFileStub.firstCall.args[1]).to.deep.equal(zipFileContents);
      expect(mkdirStub.called).to.be.false;
      expect(mdapiRetrieveExtractStub.called).to.be.false;
    });

    it('should unzip the retrieved zip when format=metadata and unzip=true', async () => {
      mdapiRetrieveExtractStub = $$.SANDBOX.stub(extractForStub, 'extract').throws();
      const mdapiRetrieve = new MetadataApiRetrieve({ usernameOrConnection, output, format, unzip: true });
      await mdapiRetrieve.post(fakeResults);

      const unpkg1Dir = join(output, 'unpackaged');
      const unpkg2Dir = join(unpkg1Dir, 'unpackaged/');
      const classesDir = join(unpkg2Dir, 'classes/');

      expect(writeFileStub.called).to.be.true;
      expect(writeFileStub.firstCall.args[0]).to.equal(join(output, 'unpackaged.zip'));
      expect(writeFileStub.firstCall.args[1]).to.deep.equal(zipFileContents);
      expect(writeFileStub.secondCall.args[0]).to.equal(join(classesDir, 'PagedResult.cls'));
      expect(writeFileStub.thirdCall.args[0]).to.equal(join(classesDir, 'PagedResult.cls-meta.xml'));
      expect(mkdirStub.called).to.be.true;
      expect(mkdirStub.firstCall.args[0]).to.equal(unpkg1Dir);
      expect(mkdirStub.secondCall.args[0]).to.equal(unpkg2Dir);
      expect(mkdirStub.thirdCall.args[0]).to.equal(classesDir);
      expect(mdapiRetrieveExtractStub.called).to.be.false;
    });

    it('should write the retrieved zip with specified name when format=metadata and zipFileName is set', async () => {
      const zipFileName = 'retrievedFiles.zip';
      const mdapiRetrieve = new MetadataApiRetrieve({ usernameOrConnection, output, format, zipFileName });
      mdapiRetrieveExtractStub = $$.SANDBOX.stub(extractForStub, 'extract').resolves({
        componentSet: new ComponentSet([]),
        partialDeleteFileResponses: [],
      });
      await mdapiRetrieve.post(fakeResults);

      expect(writeFileStub.calledOnce).to.be.true;
      expect(writeFileStub.firstCall.args[0]).to.equal(join(output, zipFileName));
      expect(writeFileStub.firstCall.args[1]).to.deep.equal(zipFileContents);
      expect(mkdirStub.called).to.be.false;
      expect(mdapiRetrieveExtractStub.called).to.be.false;
    });
  });

  describe('cancel', () => {
    it('should immediately stop polling', async () => {
      const component = COMPONENT;
      const components = new ComponentSet([component]);
      const { operation, checkStatusStub } = await stubMetadataRetrieve($$, testOrg, {
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
        const result = new RetrieveResult(apiStatus as MetadataApiRetrieveStatus, retrievedSet, retrievedSet);

        const responses = result.getFileResponses();
        const baseResponse = {
          state: ComponentStatus.Changed,
          fullName: component.fullName,
          type: component.type.name,
        } as const;
        const expected: FileResponse[] = [
          { ...baseResponse, filePath: ensureString(component.content) },
          { ...baseResponse, filePath: ensureString(component.xml) },
        ];

        expect(responses).to.deep.equal(expected);
      });
    });

    it('should report correct file status', () => {
      const component = COMPONENT;
      const newComponent = DECOMPOSED_COMPONENT;
      const retrievedSet = new ComponentSet([component, newComponent]);
      const localSet = new ComponentSet([component]);
      const apiStatus = {};
      const result = new RetrieveResult(apiStatus as MetadataApiRetrieveStatus, retrievedSet, localSet);

      const responses = result.getFileResponses();
      const baseResponse = {
        state: ComponentStatus.Changed,
        fullName: component.fullName,
        type: component.type.name,
      } as const;
      // Since the DECOMPOSED_COMPONENT was in the retrieved ComponentSet but
      // not the local source ComponentSet it should have a state of 'Created'
      // rather than 'Changed'.
      const expected: FileResponse[] = [
        { ...baseResponse, filePath: ensureString(component.content) },
        { ...baseResponse, filePath: ensureString(component.xml) },
        {
          fullName: DECOMPOSED_COMPONENT.fullName,
          filePath: ensureString(DECOMPOSED_COMPONENT.xml),
          state: ComponentStatus.Created,
          type: DECOMPOSED_COMPONENT.type.name,
        },
      ];

      expect(responses).to.deep.equal(expected);
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
      const result = new RetrieveResult(apiStatus as MetadataApiRetrieveStatus, retrievedSet, retrievedSet);

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
          filePath: ensureString(successComponent.xml),
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
     * includes children in the returned set, so we don't need to eagerly resolve
     * the children of a parent.
     */
    it('should not report content files if component type has children', () => {
      const component = DECOMPOSED_COMPONENT;
      const retrievedSet = new ComponentSet([component]);
      const apiStatus = {};
      const result = new RetrieveResult(apiStatus as MetadataApiRetrieveStatus, retrievedSet, retrievedSet);

      const responses = result.getFileResponses();
      const expected: FileResponse[] = [
        {
          state: ComponentStatus.Changed,
          fullName: component.fullName,
          type: component.type.name,
          filePath: ensureString(component.xml),
        },
      ];

      expect(responses).to.deep.equal(expected);
    });

    it('should only report xml file if the component has one', () => {
      const component = new SourceComponent(
        {
          name: 'OnlyContent',
          type: registry.types.apexclass,
          content: COMPONENT.content,
        },
        COMPONENT.tree
      );
      const retrievedSet = new ComponentSet([component]);
      const apiStatus = {};
      const result = new RetrieveResult(apiStatus as MetadataApiRetrieveStatus, retrievedSet, retrievedSet);

      const responses = result.getFileResponses();
      const expected: FileResponse[] = [
        {
          state: ComponentStatus.Changed,
          fullName: component.fullName,
          type: component.type.name,
          filePath: ensureString(component.content),
        },
      ];

      expect(responses).to.deep.equal(expected);
    });
  });
});
