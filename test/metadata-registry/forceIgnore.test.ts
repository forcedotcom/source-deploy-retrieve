import { ForceIgnore } from '../../src/metadata-registry/forceIgnore';
import { expect } from 'chai';
import { createSandbox } from 'sinon';
import * as fs from 'fs';
import * as fsUtil from '../../src/utils/fileSystemHandler';
import { FORCE_IGNORE_FILE } from '../../src/utils/constants';

const env = createSandbox();

describe('ForceIgnore', () => {
  const forceIgnorePath = '/some/.forceignore';
  const testPath = '/some/path/__tests__/myTest.x';
  const testPattern = '**/__tests__/**';

  afterEach(() => env.restore());

  it('Should default to not ignoring a file if forceignore is not loaded', () => {
    const path = '/some/path';
    const forceIgnore = new ForceIgnore();
    expect(forceIgnore.accepts(path)).to.be.true;
    expect(forceIgnore.denies(path)).to.be.false;
  });

  it('Should ignore files with a given pattern', () => {
    const readStub = env.stub(fs, 'readFileSync');
    readStub.withArgs(forceIgnorePath).returns(testPattern);
    const forceIgnore = new ForceIgnore(forceIgnorePath);
    expect(forceIgnore.accepts(testPath)).to.be.false;
    expect(forceIgnore.denies(testPath)).to.be.true;
  });

  it('Should find a forceignore file from a given path', () => {
    const readStub = env.stub(fs, 'readFileSync');
    const searchStub = env.stub(fsUtil, 'searchUp');
    readStub.withArgs(forceIgnorePath).returns(testPattern);
    searchStub.withArgs(testPath, FORCE_IGNORE_FILE).returns(forceIgnorePath);
    const forceIgnore = ForceIgnore.findAndCreate(testPath);
    expect(forceIgnore.accepts(testPath)).to.be.false;
  });

  /**
   * TODO: Rework when approach to default patterns changes. We should be able
   * to generally test the defaults system.
   */
  describe('Defaults', () => {
    let forceIgnore: ForceIgnore;

    beforeEach(() => (forceIgnore = new ForceIgnore()));

    it('Should ignore files starting with a dot', () => {
      const dotPath = '/some/path/.xyz';
      expect(forceIgnore.accepts(dotPath)).to.be.false;
      expect(forceIgnore.denies(dotPath)).to.be.true;
    });

    it('Should ignore files ending in .dup', () => {
      const dupPath = '/some/path/abc.dup';
      expect(forceIgnore.accepts(dupPath)).to.be.false;
      expect(forceIgnore.denies(dupPath)).to.be.true;
    });

    it('Should ignore files named package2-descriptor.json', () => {
      const descriptorPath = '/some/path/package2-descriptor.json';
      expect(forceIgnore.accepts(descriptorPath)).to.be.false;
      expect(forceIgnore.denies(descriptorPath)).to.be.true;
    });

    it('Should ignore files named package2-manifest.json', () => {
      const manifestPath = '/some/path/package2-manifest.json';
      expect(forceIgnore.accepts(manifestPath)).to.be.false;
      expect(forceIgnore.denies(manifestPath)).to.be.true;
    });
  });
});
