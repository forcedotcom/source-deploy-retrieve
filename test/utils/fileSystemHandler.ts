/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fsUtil from '../../src/utils/fileSystemHandler';
import { SinonStub, createSandbox } from 'sinon';
import { expect } from 'chai';
import { join } from 'path';
import * as fs from 'fs';

const env = createSandbox();

describe('File System Utils', () => {
  const root = join(process.cwd(), 'path', 'to', 'whatever');

  afterEach(() => env.restore());

  describe('walk', () => {
    let readStub: SinonStub;
    let statStub: SinonStub;

    beforeEach(() => {
      readStub = env.stub(fs, 'readdirSync');
      statStub = env.stub(fs, 'lstatSync');
    });

    const files = ['a.x', 'b.y', 'c.z'];

    it('Should collect all files in single level directory', () => {
      statStub.returns({ isDirectory: () => false });
      readStub.withArgs(root).returns(files);

      expect(fsUtil.walk(root)).to.deep.equal(files.map(f => join(root, f)));
    });

    it('Should collect files in nested directories', () => {
      const l1Files = files.concat(['d']);
      const l2Files = ['aperture science', 'e.t', 'hello_world.js'];
      const l3Files = ['theCakeIsALie.glados'];
      const dPath = join(root, 'd');
      const aperturePath = join(dPath, 'aperture science');
      readStub.withArgs(root).returns(l1Files);
      readStub.withArgs(dPath).returns(l2Files);
      readStub.withArgs(aperturePath).returns(l3Files);
      statStub.returns({ isDirectory: () => false });
      statStub.withArgs(dPath).returns({ isDirectory: () => true });
      statStub.withArgs(aperturePath).returns({ isDirectory: () => true });

      expect(fsUtil.walk(root)).to.deep.equal([
        join(root, 'a.x'),
        join(root, 'b.y'),
        join(root, 'c.z'),
        join(aperturePath, 'theCakeIsALie.glados'),
        join(dPath, 'e.t'),
        join(dPath, 'hello_world.js')
      ]);
    });

    it('Should ignore specified paths', () => {
      statStub.returns({ isDirectory: () => false });
      readStub.withArgs(root).returns(files);
      const ignore = new Set([join(root, 'b.y')]);

      expect(fsUtil.walk(root, ignore)).to.deep.equal([join(root, 'a.x'), join(root, 'c.z')]);
    });
  });

  describe('isDirectory', () => {
    it('Should utilize fs Stats to determine if path is a directory', () => {
      const statStub = env.stub(fs, 'lstatSync');
      // @ts-ignore
      statStub.withArgs(root).returns({ isDirectory: () => true });
      expect(fsUtil.isDirectory(root)).to.be.true;
    });
  });

  describe('searchUp', () => {
    let existsStub: SinonStub;
    const filePath = join(root, 'test.x');
    const startPath = join(root, 'a', 'more', 'nested', 'file.y');

    beforeEach(() => {
      existsStub = env.stub(fs, 'existsSync');
      existsStub.returns(false);
    });

    it('Should traverse up and find a file with the given file name', () => {
      existsStub.withArgs(filePath).returns(true);
      expect(fsUtil.searchUp(startPath, 'test.x')).to.equal(filePath);
    });

    it('Should return start path if it is the file being searched for', () => {
      existsStub.withArgs(filePath).returns(true);
      expect(fsUtil.searchUp(filePath, 'test.x')).to.equal(filePath);
    });

    it('Should return undefined if file not found', () => {
      expect(fsUtil.searchUp(startPath, 'asdf')).to.be.undefined;
    });
  });

  describe('ensureDirectoryExists', () => {
    let mkdirStub: SinonStub;
    let existsStub: SinonStub;

    beforeEach(() => {
      mkdirStub = env.stub(fs, 'mkdirSync');
      existsStub = env.stub(fs, 'existsSync');
    });

    it('should return immediately if file or directory already exists', () => {
      const path = join('path', 'to', 'dir');
      existsStub.withArgs(path).returns(true);

      fsUtil.ensureDirectoryExists(path);

      expect(mkdirStub.notCalled).to.be.true;
    });

    it('should create nested directories as needed', () => {
      const path = join('path', 'to');
      const path2 = join(path, 'dir');
      const path3 = join(path2, 'dir2');
      existsStub.returns(false);
      existsStub.withArgs(path).returns(true);

      fsUtil.ensureDirectoryExists(path3);

      expect(mkdirStub.firstCall.args[0]).to.equal(path2);
      expect(mkdirStub.secondCall.args[0]).to.equal(path3);
    });
  });

  describe('ensureFileExists', () => {
    it('should ensure file exists', () => {
      const path = join('path', 'to', 'a', 'file.x');
      const closeStub = env.stub(fs, 'closeSync');
      const openStub = env.stub(fs, 'openSync');
      openStub.returns(123);
      const existsSyncStub = env.stub(fs, 'existsSync').returns(true);

      fsUtil.ensureFileExists(path);

      // somewhat validating ensureDirectoryExists was called first
      expect(existsSyncStub.calledBefore(openStub)).to.be.true;
      expect(closeStub.firstCall.args[0]).to.equal(123);
    });
  });
});
