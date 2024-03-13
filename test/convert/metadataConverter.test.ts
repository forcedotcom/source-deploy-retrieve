/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { dirname, join } from 'node:path';
import { fail } from 'node:assert';
import { Messages, SfError } from '@salesforce/core';
import { SinonStub } from 'sinon';
import * as fs from 'graceful-fs';
import { assert, expect } from 'chai';
import { TestContext } from '@salesforce/core/lib/testSetup';
import { xmlInFolder } from '../mock';
import * as streams from '../../src/convert/streams';
import * as fsUtil from '../../src/utils/fileSystemHandler';
import { COMPONENTS } from '../mock/type-constants/documentFolderConstant';
import { ComponentSet, DestructiveChangesType, MetadataConverter, registry, SourceComponent } from '../../src';
import * as coverage from '../../src/registry/coverage';
import {
  DECOMPOSED_CHILD_COMPONENT_1,
  DECOMPOSED_CHILD_COMPONENT_2,
} from '../mock/type-constants/customObjectConstant';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

describe('MetadataConverter', () => {
  const $$ = new TestContext();

  let ensureDirectoryStub: SinonStub;
  let pipelineStub: SinonStub;
  let writeFileStub: SinonStub;

  const converter = new MetadataConverter();
  const components = xmlInFolder.COMPONENTS;
  const packageName = 'test';
  const outputDirectory = join('path', 'to', 'output');
  const packageOutput = join(outputDirectory, packageName);
  const testApiversion = '50.0';

  /* eslint-disable-next-line  @typescript-eslint/no-explicit-any */
  function validatePipelineArgs(pipelineArgs: any[], targetFormat = 'metadata'): void {
    expect(pipelineArgs[2] instanceof streams.ComponentConverter).to.be.true;
    expect(pipelineArgs[2].targetFormat).to.equal(targetFormat);
    expect(pipelineArgs[3] instanceof streams.ComponentWriter).to.be.true;
  }

  beforeEach(() => {
    ensureDirectoryStub = $$.SANDBOX.stub(fsUtil, 'ensureDirectoryExists');
    pipelineStub = $$.SANDBOX.stub(streams, 'pipeline').resolves();
    writeFileStub = $$.SANDBOX.stub(fs.promises, 'writeFile').resolves();
    $$.SANDBOX.stub(fs, 'createWriteStream');
    $$.SANDBOX.stub(coverage, 'getCurrentApiVersion').resolves(50);
  });

  it('should generate package name using timestamp when option omitted', async () => {
    const timestamp = 123_456;
    const packagePath = join(outputDirectory, `${MetadataConverter.DEFAULT_PACKAGE_PREFIX}_${timestamp}`);
    $$.SANDBOX.stub(Date, 'now').returns(timestamp);

    await converter.convert(components, 'metadata', {
      type: 'directory',
      outputDirectory,
    });

    expect(pipelineStub.firstCall.args[3].rootDestination).to.equal(packagePath);
  });

  it('should convert to specified output dir', async () => {
    await converter.convert(components, 'metadata', {
      type: 'directory',
      outputDirectory,
      genUniqueDir: false,
    });

    expect(pipelineStub.firstCall.args[3].rootDestination).to.equal(outputDirectory);
  });

  it('should throw ConversionError when an error occurs', async () => {
    const error = new Error('whoops!');
    const expectedError = new SfError(
      messages.getMessage('error_failed_convert', [error.message]),
      'ConversionError',
      [],
      error
    );
    pipelineStub.rejects(error);

    try {
      await converter.convert(components, 'metadata', {
        type: 'directory',
        outputDirectory,
      });
      assert.fail('an error should have been thrown');
    } catch (e) {
      assert(e instanceof Error);
      expect(e.message).to.equal(expectedError.message);
      expect(e.name).to.equal(expectedError.name);
    }
  });

  describe('Directory Output', () => {
    it('should ensure directory exists before starting conversion', async () => {
      await converter.convert(components, 'metadata', {
        type: 'directory',
        outputDirectory,
        packageName,
      });

      expect(ensureDirectoryStub.calledBefore(pipelineStub)).to.be.true;
      expect(ensureDirectoryStub.firstCall.args[0]).to.equal(packageOutput);
    });

    it('should create conversion pipeline with proper stream configuration', async () => {
      await converter.convert(components, 'metadata', {
        type: 'directory',
        outputDirectory,
        packageName,
      });

      const pipelineArgs = pipelineStub.firstCall.args;
      validatePipelineArgs(pipelineArgs);
      expect(pipelineArgs[3] instanceof streams.StandardWriter).to.be.true;
      expect(pipelineArgs[3].rootDestination).to.equal(packageOutput);
    });

    it('should create conversion pipeline with normalized output directory', async () => {
      await converter.convert(components, 'metadata', {
        type: 'directory',
        outputDirectory: './',
        packageName,
      });

      const pipelineArgs = pipelineStub.firstCall.args;
      validatePipelineArgs(pipelineArgs);
      expect(pipelineArgs[3] instanceof streams.StandardWriter).to.be.true;
      expect(pipelineArgs[3].rootDestination).to.equal(packageName);
    });

    it('should return packagePath in result', async () => {
      const result = await converter.convert(components, 'metadata', {
        type: 'directory',
        outputDirectory,
        packageName,
      });

      expect(result.packagePath).to.equal(packageOutput);
    });

    it('should write manifest for metadata format conversion', async () => {
      const timestamp = 123_456;
      const packagePath = join(outputDirectory, `${MetadataConverter.DEFAULT_PACKAGE_PREFIX}_${timestamp}`);
      $$.SANDBOX.stub(Date, 'now').returns(timestamp);
      const expectedContents = await new ComponentSet(components).getPackageXml();

      await converter.convert(components, 'metadata', { type: 'directory', outputDirectory });

      expect(writeFileStub.calledBefore(pipelineStub)).to.be.true;
      expect(writeFileStub.firstCall.args).to.deep.equal([
        join(packagePath, MetadataConverter.PACKAGE_XML_FILE),
        expectedContents,
      ]);
    });

    it('should write destructive changes post manifest when ComponentSet has deletes marked for post', async () => {
      const timestamp = 123_456;
      const packagePath = join(outputDirectory, `${MetadataConverter.DEFAULT_PACKAGE_PREFIX}_${timestamp}`);
      $$.SANDBOX.stub(Date, 'now').returns(timestamp);
      const component1 = new SourceComponent({
        name: DECOMPOSED_CHILD_COMPONENT_1.name,
        type: DECOMPOSED_CHILD_COMPONENT_1.type,
        xml: DECOMPOSED_CHILD_COMPONENT_1.xml,
      });
      component1.setMarkedForDelete(DestructiveChangesType.POST);
      const component2 = new SourceComponent({
        name: DECOMPOSED_CHILD_COMPONENT_2.name,
        type: DECOMPOSED_CHILD_COMPONENT_2.type,
        xml: DECOMPOSED_CHILD_COMPONENT_2.xml,
      });
      const compSet = new ComponentSet([component1, component2]);
      const expectedDestructiveContents = await compSet.getPackageXml(undefined, DestructiveChangesType.POST);
      const expectedContents = await compSet.getPackageXml();

      await converter.convert(compSet, 'metadata', { type: 'directory', outputDirectory });

      expect(writeFileStub.calledBefore(pipelineStub)).to.be.true;
      expect(writeFileStub.firstCall.args).to.deep.equal([
        join(packagePath, MetadataConverter.PACKAGE_XML_FILE),
        expectedContents,
      ]);
      expect(writeFileStub.secondCall.args).to.deep.equal([
        join(packagePath, MetadataConverter.DESTRUCTIVE_CHANGES_POST_XML_FILE),
        expectedDestructiveContents,
      ]);
    });

    it('should write destructive changes pre manifest when ComponentSet has deletes', async () => {
      const timestamp = 123_456;
      const packagePath = join(outputDirectory, `${MetadataConverter.DEFAULT_PACKAGE_PREFIX}_${timestamp}`);
      $$.SANDBOX.stub(Date, 'now').returns(timestamp);
      const component1 = new SourceComponent({
        name: DECOMPOSED_CHILD_COMPONENT_1.name,
        type: DECOMPOSED_CHILD_COMPONENT_1.type,
        xml: DECOMPOSED_CHILD_COMPONENT_1.xml,
      });
      component1.setMarkedForDelete(DestructiveChangesType.PRE);
      const component2 = new SourceComponent({
        name: DECOMPOSED_CHILD_COMPONENT_2.name,
        type: DECOMPOSED_CHILD_COMPONENT_2.type,
        xml: DECOMPOSED_CHILD_COMPONENT_2.xml,
      });
      const compSet = new ComponentSet([component1, component2]);
      compSet.setDestructiveChangesType(DestructiveChangesType.PRE);
      const expectedDestructiveContents = await compSet.getPackageXml(undefined, DestructiveChangesType.PRE);
      const expectedContents = await compSet.getPackageXml();

      await converter.convert(compSet, 'metadata', { type: 'directory', outputDirectory });

      expect(writeFileStub.calledBefore(pipelineStub)).to.be.true;
      expect(writeFileStub.firstCall.args).to.deep.equal([
        join(packagePath, MetadataConverter.PACKAGE_XML_FILE),
        expectedContents,
      ]);
      expect(writeFileStub.secondCall.args).to.deep.equal([
        join(packagePath, MetadataConverter.DESTRUCTIVE_CHANGES_PRE_XML_FILE),
        expectedDestructiveContents,
      ]);
    });

    it('should write manifest for metadata format conversion with sourceApiVersion', async () => {
      const timestamp = 123_456;
      const packagePath = join(outputDirectory, `${MetadataConverter.DEFAULT_PACKAGE_PREFIX}_${timestamp}`);
      $$.SANDBOX.stub(Date, 'now').returns(timestamp);
      const compSet = new ComponentSet(components);
      compSet.sourceApiVersion = testApiversion;
      const expectedContents = await compSet.getPackageXml();

      await converter.convert(compSet, 'metadata', { type: 'directory', outputDirectory });

      expect(writeFileStub.calledBefore(pipelineStub)).to.be.true;
      expect(writeFileStub.firstCall.args).to.deep.equal([
        join(packagePath, MetadataConverter.PACKAGE_XML_FILE),
        expectedContents,
      ]);
      expect(expectedContents).to.contain(`<version>${testApiversion}</version>`);
    });

    it('should write the fullName entry when packageName is provided', async () => {
      const timestamp = 123_456;
      const packageName = 'examplePackage';
      const packagePath = join(outputDirectory, packageName);
      $$.SANDBOX.stub(Date, 'now').returns(timestamp);
      const cs = new ComponentSet(components);
      cs.fullName = packageName;
      const expectedContents = await cs.getPackageXml();

      await converter.convert(components, 'metadata', {
        type: 'directory',
        outputDirectory,
        packageName,
      });

      expect(writeFileStub.calledBefore(pipelineStub)).to.be.true;
      expect(writeFileStub.firstCall.args).to.deep.equal([
        join(packagePath, MetadataConverter.PACKAGE_XML_FILE),
        expectedContents,
      ]);
    });

    it('should not write manifest for source format conversion', async () => {
      await converter.convert(components, 'source', { type: 'directory', outputDirectory });

      expect(writeFileStub.notCalled).to.be.true;
    });
  });

  describe('Zip Output', () => {
    it('should ensure directory exists before starting conversion', async () => {
      const zipPath = packageOutput + '.zip';
      await converter.convert(components, 'metadata', {
        type: 'zip',
        outputDirectory,
        packageName,
      });

      expect(ensureDirectoryStub.calledBefore(pipelineStub)).to.be.true;
      expect(ensureDirectoryStub.firstCall.args[0]).to.equal(dirname(zipPath));
    });

    it('should convert to specified output dir', async () => {
      const zipPath = outputDirectory + '.zip';
      const testBuffer = Buffer.from('🥔');
      $$.SANDBOX.stub(streams.ZipWriter.prototype, 'buffer').value(testBuffer);
      await converter.convert(components, 'metadata', {
        type: 'zip',
        outputDirectory,
        genUniqueDir: false,
      });

      expect(ensureDirectoryStub.calledBefore(pipelineStub)).to.be.true;
      expect(writeFileStub.firstCall.args[0]).to.equal(zipPath);
      expect(writeFileStub.firstCall.args[1]).to.deep.equal(testBuffer);
    });

    it('should not return zipBuffer result when outputDirectory is specified', async () => {
      const testBuffer = Buffer.from('🥔');
      $$.SANDBOX.stub(streams.ZipWriter.prototype, 'buffer').value(testBuffer);
      const result = await converter.convert(components, 'metadata', {
        type: 'zip',
        outputDirectory,
        genUniqueDir: false,
      });

      expect(result.zipBuffer).to.be.undefined;
    });

    it('should return zipBuffer result for in-memory configuration', async () => {
      const testBuffer = Buffer.from('oh hi mark');
      $$.SANDBOX.stub(streams.ZipWriter.prototype, 'buffer').value(testBuffer);

      const result = await converter.convert(components, 'metadata', { type: 'zip' });

      expect(result.zipBuffer).to.deep.equal(testBuffer);
    });

    it('should return packagePath in result', async () => {
      const result = await converter.convert(components, 'metadata', {
        type: 'zip',
        outputDirectory,
        packageName,
      });

      expect(result.packagePath).to.equal(`${packageOutput}.zip`);
    });

    it('should write manifest for metadata format conversion', async () => {
      const expectedContents = await new ComponentSet(components).getPackageXml();
      const addToZipStub = $$.SANDBOX.stub(streams.ZipWriter.prototype, 'addToZip');

      await converter.convert(components, 'metadata', { type: 'zip' });

      expect(addToZipStub.calledBefore(pipelineStub)).to.be.true;
      expect(addToZipStub.firstCall.args).to.deep.equal([expectedContents, MetadataConverter.PACKAGE_XML_FILE]);
    });

    it('should write destructive changes post manifest when ComponentSet has deletes', async () => {
      const component1 = new SourceComponent({
        name: DECOMPOSED_CHILD_COMPONENT_1.name,
        type: DECOMPOSED_CHILD_COMPONENT_1.type,
        xml: DECOMPOSED_CHILD_COMPONENT_1.xml,
      });
      component1.setMarkedForDelete();
      const component2 = new SourceComponent({
        name: DECOMPOSED_CHILD_COMPONENT_2.name,
        type: DECOMPOSED_CHILD_COMPONENT_2.type,
        xml: DECOMPOSED_CHILD_COMPONENT_2.xml,
      });
      const compSet = new ComponentSet([component1, component2]);
      compSet.apiVersion = testApiversion;

      const expectedDestructiveContents = await compSet.getPackageXml(undefined, DestructiveChangesType.POST);
      const expectedContents = await compSet.getPackageXml();
      const addToZipStub = $$.SANDBOX.stub(streams.ZipWriter.prototype, 'addToZip');

      await converter.convert(compSet, 'metadata', { type: 'zip' });

      expect(addToZipStub.calledBefore(pipelineStub)).to.be.true;
      expect(addToZipStub.firstCall.args).to.deep.equal([expectedContents, MetadataConverter.PACKAGE_XML_FILE]);
      expect(addToZipStub.secondCall.args).to.deep.equal([
        expectedDestructiveContents,
        MetadataConverter.DESTRUCTIVE_CHANGES_POST_XML_FILE,
      ]);
    });

    it('should write destructive changes pre manifest when ComponentSet has deletes marked for pre', async () => {
      const component1 = new SourceComponent({
        name: DECOMPOSED_CHILD_COMPONENT_1.name,
        type: DECOMPOSED_CHILD_COMPONENT_1.type,
        xml: DECOMPOSED_CHILD_COMPONENT_1.xml,
      });
      component1.setMarkedForDelete(DestructiveChangesType.PRE);
      const component2 = new SourceComponent({
        name: DECOMPOSED_CHILD_COMPONENT_2.name,
        type: DECOMPOSED_CHILD_COMPONENT_2.type,
        xml: DECOMPOSED_CHILD_COMPONENT_2.xml,
      });
      const compSet = new ComponentSet([component1, component2]);
      compSet.apiVersion = testApiversion;
      compSet.setDestructiveChangesType(DestructiveChangesType.PRE);
      const expectedDestructiveContents = await compSet.getPackageXml(4, DestructiveChangesType.PRE);
      const expectedContents = await compSet.getPackageXml();
      const addToZipStub = $$.SANDBOX.stub(streams.ZipWriter.prototype, 'addToZip');

      await converter.convert(compSet, 'metadata', { type: 'zip' });

      expect(addToZipStub.calledBefore(pipelineStub)).to.be.true;
      expect(addToZipStub.firstCall.args).to.deep.equal([expectedContents, MetadataConverter.PACKAGE_XML_FILE]);
      expect(addToZipStub.secondCall.args).to.deep.equal([
        expectedDestructiveContents,
        MetadataConverter.DESTRUCTIVE_CHANGES_PRE_XML_FILE,
      ]);
    });

    it('should not write manifest for source format conversion', async () => {
      const addToZipStub = $$.SANDBOX.stub(streams.ZipWriter.prototype, 'addToZip');

      await converter.convert(components, 'source', { type: 'zip' });

      expect(addToZipStub.notCalled).to.be.true;
    });
  });

  describe('Merge Output', () => {
    const defaultDirectory = join('path', 'to', 'default');

    it('should throw error if merge config provided for metadata target format', async () => {
      const errorToWrap = new SfError(messages.getMessage('error_merge_metadata_target_unsupported'));
      const expectedError = new SfError(
        messages.getMessage('error_failed_convert', [errorToWrap.message]),
        'ConversionError',
        [],
        errorToWrap
      );

      try {
        await converter.convert(components, 'metadata', {
          type: 'merge',
          defaultDirectory,
          mergeWith: COMPONENTS,
        });
        fail(`should have thrown a ${expectedError.name} error`);
      } catch (e) {
        assert(e instanceof SfError);
        expect(e.name).to.equal('ConversionError');
        expect(e.message).to.equal(expectedError.message);
      }
    });

    it('should create conversion pipeline with proper configuration', async () => {
      await converter.convert(components, 'source', {
        type: 'merge',
        defaultDirectory,
        mergeWith: COMPONENTS,
      });

      const pipelineArgs = pipelineStub.firstCall.args;
      validatePipelineArgs(pipelineArgs, 'source');
      expect(pipelineArgs[2].mergeSet).to.deep.equal(new ComponentSet(COMPONENTS));
      expect(pipelineArgs[3].rootDestination).to.equal(defaultDirectory);
    });

    it('should create conversion pipeline with addressable components', async () => {
      components.push({
        type: registry.types.customobjecttranslation.children?.types.customfieldtranslation,
        name: 'myFieldTranslation',
      } as SourceComponent);

      expect(components.length).to.equal(4);
      await converter.convert(components, 'source', {
        type: 'merge',
        defaultDirectory,
        mergeWith: COMPONENTS,
      });

      const pipelineArgs = pipelineStub.firstCall.args;
      validatePipelineArgs(pipelineArgs, 'source');

      // pop off the CFT that should be filtered off for the assertion
      components.pop();
      expect(pipelineArgs[3].rootDestination).to.equal(defaultDirectory);
    });

    it('should ensure merge set contains parents of child components instead of the children themselves', async () => {
      assert(DECOMPOSED_CHILD_COMPONENT_1.parent?.xml);
      await converter.convert(components, 'source', {
        type: 'merge',
        defaultDirectory,
        mergeWith: [DECOMPOSED_CHILD_COMPONENT_1, DECOMPOSED_CHILD_COMPONENT_2],
      });

      const pipelineArgs = pipelineStub.firstCall.args;
      validatePipelineArgs(pipelineArgs, 'source');
      expect(pipelineArgs[2].mergeSet).to.deep.equal(new ComponentSet([DECOMPOSED_CHILD_COMPONENT_1.parent]));
    });
  });
});
