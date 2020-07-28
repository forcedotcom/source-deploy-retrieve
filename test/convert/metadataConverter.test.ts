/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { MetadataConverter } from '../../src/convert';
import { createSandbox, SinonStub } from 'sinon';
import { kathy, mockRegistry } from '../mock/registry';
import { ManifestGenerator, RegistryAccess, registryData } from '../../src/metadata-registry';
import * as streams from '../../src/convert/streams';
import * as fs from 'fs';
import * as fsUtil from '../../src/utils/fileSystemHandler';
import { join } from 'path';
import { expect, assert } from 'chai';
import { PACKAGE_XML_FILE, DEFAULT_PACKAGE_PREFIX } from '../../src/utils/constants';
import { ConversionError } from '../../src/errors';

const env = createSandbox();

describe('MetadataConverter', () => {
  let ensureDirectoryStub: SinonStub;
  let pipelineStub: SinonStub;
  let writeFileStub: SinonStub;

  const mockRegistryAccess = new RegistryAccess(mockRegistry);
  const converter = new MetadataConverter(mockRegistryAccess);
  const components = kathy.KATHY_COMPONENTS;
  const packageName = 'test';
  const outputDirectory = join('path', 'to', 'output');
  const packageOutput = join(outputDirectory, packageName);
  /* eslint-disable-next-line  @typescript-eslint/no-explicit-any */
  function validatePipelineArgs(pipelineArgs: any[]): void {
    expect(pipelineArgs[0] instanceof streams.ComponentReader).to.be.true;
    expect(pipelineArgs[0].components).to.deep.equal(components);
    expect(pipelineArgs[1] instanceof streams.ComponentConverter).to.be.true;
    expect(pipelineArgs[1].targetFormat).to.equal('metadata');
    expect(pipelineArgs[2] instanceof streams.ComponentWriter).to.be.true;
  }

  beforeEach(() => {
    ensureDirectoryStub = env.stub(fsUtil, 'ensureDirectoryExists');
    pipelineStub = env.stub(streams, 'pipeline').resolves();
    writeFileStub = env.stub(fs.promises, 'writeFile').resolves();
    env.stub(fs, 'createWriteStream');
  });
  afterEach(() => env.restore());

  it('should initialize with default RegistryAccess by default', () => {
    const defaultConverter = new MetadataConverter();
    // @ts-ignore registryAccess private
    expect(defaultConverter.registryAccess.registry).to.deep.equal(registryData);
  });

  it('should generate package name using timestamp when option omitted', async () => {
    const timestamp = 123456;
    const packagePath = join(outputDirectory, `${DEFAULT_PACKAGE_PREFIX}_${timestamp}`);
    env.stub(Date, 'now').returns(timestamp);

    await converter.convert(components, 'metadata', {
      type: 'directory',
      outputDirectory,
    });

    expect(pipelineStub.firstCall.args[2].rootDestination).to.equal(packagePath);
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

    it('should write a manifest for directory configuration', async () => {
      const expectedPath = join(packageOutput, PACKAGE_XML_FILE);
      const expectedContents = new ManifestGenerator(mockRegistryAccess).createManifest(components);

      await converter.convert(components, 'metadata', {
        type: 'directory',
        outputDirectory,
        packageName,
      });

      expect(writeFileStub.firstCall.args).to.deep.equal([expectedPath, expectedContents]);
    });

    it('should return packagePath in result', async () => {
      const result = await converter.convert(components, 'metadata', {
        type: 'directory',
        outputDirectory,
        packageName,
      });

      expect(result.packagePath).to.equal(packageOutput);
    });
  });

  describe('Zip Output', () => {
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

    it('should write manifest for zip configuration', async () => {
      const expectedContents = new ManifestGenerator(mockRegistryAccess).createManifest(components);
      const addToZipStub = env.stub(streams.ZipWriter.prototype, 'addToZip');

      await converter.convert(components, 'metadata', { type: 'zip' });

      expect(addToZipStub.calledBefore(pipelineStub)).to.be.true;
      expect(addToZipStub.firstCall.args).to.deep.equal([expectedContents, PACKAGE_XML_FILE]);
    });
  });
});
