import { MetadataConverter } from '../../src/convert';
import { createSandbox, SinonStub } from 'sinon';
import { kathy, mockRegistry } from '../mock/registry';
import { ManifestGenerator, RegistryAccess, registryData } from '../../src/metadata-registry';
import * as streams from '../../src/convert/streams';
import { promises } from 'fs';
import * as fsUtil from '../../src/utils/fileSystemHandler';
import { join } from 'path';
import { expect, assert } from 'chai';
import { PACKAGE_XML_FILE, DEFAULT_PACKAGE_PREFIX } from '../../src/utils/constants';
import { ConversionError } from '../../src/errors';

const env = createSandbox();

describe('Convert', () => {
  let ensureDir: SinonStub;
  let pipeline: SinonStub;
  let writeFile: SinonStub;

  beforeEach(() => {
    ensureDir = env.stub(fsUtil, 'ensureDirectoryExists');
    pipeline = env.stub(streams, 'pipeline').resolves();
    writeFile = env.stub(promises, 'writeFile').resolves();
  });
  afterEach(() => env.restore());

  const mockRegistryAccess = new RegistryAccess(mockRegistry);
  const converter = new MetadataConverter(mockRegistryAccess);
  const components = kathy.KATHY_COMPONENTS;
  const packageName = 'test';
  const outputDirectory = join('path', 'to', 'output');
  const packageOutput = join(outputDirectory, packageName);

  it('should write a manifest to the output', async () => {
    const expectedPath = join(packageOutput, PACKAGE_XML_FILE);
    const expectedContents = new ManifestGenerator(mockRegistryAccess).createManifest(components);

    await converter.convert(components, 'metadata', {
      type: 'directory',
      options: { outputDirectory, packageName }
    });

    expect(writeFile.firstCall.args).to.deep.equal([expectedPath, expectedContents]);
  });

  it('should generate package name using timestamp when option omitted', async () => {
    const timestamp = 123456;
    const packagePath = join(outputDirectory, `${DEFAULT_PACKAGE_PREFIX}_${timestamp}`);
    env.stub(Date, 'now').returns(timestamp);

    await converter.convert(components, 'metadata', {
      type: 'directory',
      options: { outputDirectory }
    });

    expect(pipeline.firstCall.args[2].rootDestination).to.equal(packagePath);
  });

  it('should ensure directory exists before starting conversion', async () => {
    await converter.convert(components, 'metadata', {
      type: 'directory',
      options: { outputDirectory, packageName }
    });

    expect(ensureDir.calledBefore(pipeline)).to.be.true;
    expect(ensureDir.firstCall.args[0]).to.equal(packageOutput);
  });

  it('should create a pipeline with proper stream configuration', async () => {
    await converter.convert(components, 'metadata', {
      type: 'directory',
      options: { outputDirectory, packageName }
    });

    const pipelineArgs = pipeline.firstCall.args;
    expect(pipelineArgs[0].components).to.deep.equal(components);
    expect(pipelineArgs[1].targetFormat).to.equal('metadata');
    expect(pipelineArgs[2].rootDestination).to.equal(packageOutput);
  });

  it('should throw ConversionError when an error occurs', async () => {
    const error = new Error('whoops!');
    pipeline.rejects(error);
    const expectedError = new ConversionError(error);
    try {
      await converter.convert(components, 'metadata', {
        type: 'directory',
        options: { outputDirectory }
      });
      assert.fail('an error should have been thrown');
    } catch (e) {
      expect(e.message).to.equal(expectedError.message);
      expect(e.name).to.equal(expectedError.name);
    }
  });

  it('should initialize with default RegistryAccess by default', () => {
    const defaultConverter = new MetadataConverter();
    // @ts-ignore
    expect(defaultConverter.registryAccess.data).to.deep.equal(registryData);
  });
});
