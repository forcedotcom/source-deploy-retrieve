/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { createSandbox, SinonStub } from 'sinon';
import { mockRegistry, xmlInFolder } from '../mock/registry';
import * as streams from '../../src/convert/streams';
import * as fs from 'graceful-fs';
import * as fsUtil from '../../src/utils/fileSystemHandler';
import { dirname, join } from 'path';
import { assert, expect } from 'chai';
import { ConversionError, LibraryError } from '../../src/errors';
import { COMPONENTS } from '../mock/registry/type-constants/mixedContentInFolderConstants';
import { fail } from 'assert';
import {
  ComponentSet,
  DestructiveChangesType,
  MetadataConverter,
  SourceComponent,
} from '../../src';
import {
  DECOMPOSED_CHILD_COMPONENT_1,
  DECOMPOSED_CHILD_COMPONENT_2,
} from '../mock/registry/type-constants/decomposedConstants';

const env = createSandbox();

describe('MetadataConverter', () => {
  let ensureDirectoryStub: SinonStub;
  let pipelineStub: SinonStub;
  let writeFileStub: SinonStub;

  const converter = new MetadataConverter(mockRegistry);
  const components = xmlInFolder.COMPONENTS;
  const packageName = 'test';
  const outputDirectory = join('path', 'to', 'output');
  const packageOutput = join(outputDirectory, packageName);

  /* eslint-disable-next-line  @typescript-eslint/no-explicit-any */
  function validatePipelineArgs(pipelineArgs: any[], targetFormat = 'metadata'): void {
    expect(pipelineArgs[0] instanceof streams.ComponentReader).to.be.true;
    expect(pipelineArgs[1] instanceof streams.ComponentConverter).to.be.true;
    expect(pipelineArgs[1].targetFormat).to.equal(targetFormat);
    expect(pipelineArgs[2] instanceof streams.ComponentWriter).to.be.true;
  }

  beforeEach(() => {
    ensureDirectoryStub = env.stub(fsUtil, 'ensureDirectoryExists');
    pipelineStub = env.stub(streams, 'pipeline').resolves();
    writeFileStub = env.stub(fs.promises, 'writeFile').resolves();
    env.stub(fs, 'createWriteStream');
  });

  afterEach(() => env.restore());

  it('should generate package name using timestamp when option omitted', async () => {
    const timestamp = 123456;
    const packagePath = join(
      outputDirectory,
      `${MetadataConverter.DEFAULT_PACKAGE_PREFIX}_${timestamp}`
    );
    env.stub(Date, 'now').returns(timestamp);

    await converter.convert(components, 'metadata', {
      type: 'directory',
      outputDirectory,
    });

    expect(pipelineStub.firstCall.args[2].rootDestination).to.equal(packagePath);
  });

  it('should convert to specified output dir', async () => {
    await converter.convert(components, 'metadata', {
      type: 'directory',
      outputDirectory,
      genUniqueDir: false,
    });

    expect(pipelineStub.firstCall.args[2].rootDestination).to.equal(outputDirectory);
  });

  it('should throw ConversionError when an error occurs', async () => {
    const error = new Error('whoops!');
    const expectedError = new ConversionError(error);
    pipelineStub.rejects(error);

    try {
      await converter.convert(components, 'metadata', {
        type: 'directory',
        outputDirectory,
      });
      assert.fail('an error should have been thrown');
    } catch (e) {
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
      expect(pipelineArgs[2] instanceof streams.StandardWriter).to.be.true;
      expect(pipelineArgs[2].rootDestination).to.equal(packageOutput);
    });

    it('should create conversion pipeline with normalized output directory', async () => {
      await converter.convert(components, 'metadata', {
        type: 'directory',
        outputDirectory: './',
        packageName,
      });

      const pipelineArgs = pipelineStub.firstCall.args;
      validatePipelineArgs(pipelineArgs);
      expect(pipelineArgs[2] instanceof streams.StandardWriter).to.be.true;
      expect(pipelineArgs[2].rootDestination).to.equal(packageName);
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
      const timestamp = 123456;
      const packagePath = join(
        outputDirectory,
        `${MetadataConverter.DEFAULT_PACKAGE_PREFIX}_${timestamp}`
      );
      env.stub(Date, 'now').returns(timestamp);
      const expectedContents = new ComponentSet(components, mockRegistry).getPackageXml();

      await converter.convert(components, 'metadata', { type: 'directory', outputDirectory });

      expect(writeFileStub.calledBefore(pipelineStub)).to.be.true;
      expect(writeFileStub.firstCall.args).to.deep.equal([
        join(packagePath, MetadataConverter.PACKAGE_XML_FILE),
        expectedContents,
      ]);
    });

    it('should write destructive changes post manifest when ComponentSet has deletes marked for post', async () => {
      const timestamp = 123456;
      const packagePath = join(
        outputDirectory,
        `${MetadataConverter.DEFAULT_PACKAGE_PREFIX}_${timestamp}`
      );
      env.stub(Date, 'now').returns(timestamp);
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
      const compSet = new ComponentSet([component1, component2], mockRegistry);
      const expectedDestructiveContents = compSet.getPackageXml(
        undefined,
        DestructiveChangesType.POST
      );
      const expectedContents = compSet.getPackageXml();

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
      const timestamp = 123456;
      const packagePath = join(
        outputDirectory,
        `${MetadataConverter.DEFAULT_PACKAGE_PREFIX}_${timestamp}`
      );
      env.stub(Date, 'now').returns(timestamp);
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
      const compSet = new ComponentSet([component1, component2], mockRegistry);
      compSet.setDestructiveChangesType(DestructiveChangesType.PRE);
      const expectedDestructiveContents = compSet.getPackageXml(
        undefined,
        DestructiveChangesType.PRE
      );
      const expectedContents = compSet.getPackageXml();

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
      const timestamp = 123456;
      const packagePath = join(
        outputDirectory,
        `${MetadataConverter.DEFAULT_PACKAGE_PREFIX}_${timestamp}`
      );
      env.stub(Date, 'now').returns(timestamp);
      const compSet = new ComponentSet(components, mockRegistry);
      compSet.sourceApiVersion = '45.0';
      const expectedContents = compSet.getPackageXml();

      await converter.convert(compSet, 'metadata', { type: 'directory', outputDirectory });

      expect(writeFileStub.calledBefore(pipelineStub)).to.be.true;
      expect(writeFileStub.firstCall.args).to.deep.equal([
        join(packagePath, MetadataConverter.PACKAGE_XML_FILE),
        expectedContents,
      ]);
      expect(expectedContents).to.contain(`<version>${compSet.sourceApiVersion}</version>`);
    });

    it('should write the fullName entry when packageName is provided', async () => {
      const timestamp = 123456;
      const packageName = 'examplePackage';
      const packagePath = join(outputDirectory, packageName);
      env.stub(Date, 'now').returns(timestamp);
      const cs = new ComponentSet(components, mockRegistry);
      cs.fullName = packageName;
      const expectedContents = cs.getPackageXml();

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
      await converter.convert(components, 'metadata', {
        type: 'zip',
        outputDirectory,
        genUniqueDir: false,
      });

      expect(ensureDirectoryStub.calledBefore(pipelineStub)).to.be.true;
      expect(ensureDirectoryStub.firstCall.args[0]).to.equal(dirname(zipPath));
    });

    it('should create conversion pipeline with fs write configuration', async () => {
      await converter.convert(components, 'metadata', {
        type: 'zip',
        outputDirectory,
        packageName,
      });

      // secondCall is used because ZipWriter uses pipeline upon construction
      const pipelineArgs = pipelineStub.secondCall.args;
      validatePipelineArgs(pipelineArgs);
      expect(pipelineArgs[2] instanceof streams.ZipWriter).to.be.true;
      expect(pipelineArgs[2].rootDestination).to.equal(`${packageOutput}.zip`);
    });

    it('should create conversion pipeline with in-memory configuration', async () => {
      await converter.convert(components, 'metadata', { type: 'zip' });

      const pipelineArgs = pipelineStub.secondCall.args;
      validatePipelineArgs(pipelineArgs);
      expect(pipelineArgs[2] instanceof streams.ZipWriter).to.be.true;
      expect(pipelineArgs[2].rootDestination).to.be.undefined;
    });

    it('should return zipBuffer result for in-memory configuration', async () => {
      const testBuffer = Buffer.from('oh hi mark');
      env.stub(streams.ZipWriter.prototype, 'buffer').value(testBuffer);

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
      const expectedContents = new ComponentSet(components, mockRegistry).getPackageXml();
      const addToZipStub = env.stub(streams.ZipWriter.prototype, 'addToZip');

      await converter.convert(components, 'metadata', { type: 'zip' });

      expect(addToZipStub.calledBefore(pipelineStub)).to.be.true;
      expect(addToZipStub.firstCall.args).to.deep.equal([
        expectedContents,
        MetadataConverter.PACKAGE_XML_FILE,
      ]);
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
      const compSet = new ComponentSet([component1, component2], mockRegistry);
      const expectedDestructiveContents = compSet.getPackageXml(
        undefined,
        DestructiveChangesType.POST
      );
      const expectedContents = compSet.getPackageXml();
      const addToZipStub = env.stub(streams.ZipWriter.prototype, 'addToZip');

      await converter.convert(compSet, 'metadata', { type: 'zip' });

      expect(addToZipStub.calledBefore(pipelineStub)).to.be.true;
      expect(addToZipStub.firstCall.args).to.deep.equal([
        expectedContents,
        MetadataConverter.PACKAGE_XML_FILE,
      ]);
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
      const compSet = new ComponentSet([component1, component2], mockRegistry);
      compSet.setDestructiveChangesType(DestructiveChangesType.PRE);
      const expectedDestructiveContents = compSet.getPackageXml(4, DestructiveChangesType.PRE);
      const expectedContents = compSet.getPackageXml();
      const addToZipStub = env.stub(streams.ZipWriter.prototype, 'addToZip');

      await converter.convert(compSet, 'metadata', { type: 'zip' });

      expect(addToZipStub.calledBefore(pipelineStub)).to.be.true;
      expect(addToZipStub.firstCall.args).to.deep.equal([
        expectedContents,
        MetadataConverter.PACKAGE_XML_FILE,
      ]);
      expect(addToZipStub.secondCall.args).to.deep.equal([
        expectedDestructiveContents,
        MetadataConverter.DESTRUCTIVE_CHANGES_PRE_XML_FILE,
      ]);
    });

    it('should not write manifest for source format conversion', async () => {
      const addToZipStub = env.stub(streams.ZipWriter.prototype, 'addToZip');

      await converter.convert(components, 'source', { type: 'zip' });

      expect(addToZipStub.notCalled).to.be.true;
    });
  });

  describe('Merge Output', () => {
    const defaultDirectory = join('path', 'to', 'default');

    it('should throw error if merge config provided for metadata target format', async () => {
      const expectedError = new ConversionError(
        new LibraryError('error_merge_metadata_target_unsupported')
      );
      try {
        await converter.convert(components, 'metadata', {
          type: 'merge',
          defaultDirectory,
          mergeWith: COMPONENTS,
        });
        fail(`should have thrown a ${expectedError.name} error`);
      } catch (e) {
        expect(e.name).to.equal(ConversionError.name);
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
      expect(pipelineArgs[1].mergeSet).to.deep.equal(new ComponentSet(COMPONENTS));
      expect(pipelineArgs[2].rootDestination).to.equal(defaultDirectory);
    });

    it('should ensure merge set contains parents of child components instead of the children themselves', async () => {
      await converter.convert(components, 'source', {
        type: 'merge',
        defaultDirectory,
        mergeWith: [DECOMPOSED_CHILD_COMPONENT_1, DECOMPOSED_CHILD_COMPONENT_2],
      });

      const pipelineArgs = pipelineStub.firstCall.args;
      validatePipelineArgs(pipelineArgs, 'source');
      expect(pipelineArgs[1].mergeSet).to.deep.equal(
        new ComponentSet([DECOMPOSED_CHILD_COMPONENT_1.parent])
      );
    });
  });
});
