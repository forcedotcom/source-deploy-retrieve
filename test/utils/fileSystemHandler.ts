/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'node:path';
import { SinonStub, createSandbox } from 'sinon';
import { expect } from 'chai';
import * as fs from 'graceful-fs';
import * as fsUtil from '../../src/utils/fileSystemHandler';

const env = createSandbox();

describe('File System Utils', () => {
  const root = join(process.cwd(), 'path', 'to', 'whatever');

  afterEach(() => env.restore());

  describe('searchUp', () => {
    let existsStub: SinonStub;
    const filePath = join(root, 'test.x');
    const startPath = join(root, 'a', 'more', 'nested', 'file.y');

    beforeEach(() => {
      existsStub = env.stub(fs, 'existsSync');
      existsStub.returns(false);
    });

    it('should traverse up and find a file with the given file name', () => {
      existsStub.withArgs(filePath).returns(true);
      expect(fsUtil.searchUp(startPath, 'test.x')).to.equal(filePath);
    });

    it('should return start path if it is the file being searched for', () => {
      existsStub.withArgs(filePath).returns(true);
      expect(fsUtil.searchUp(filePath, 'test.x')).to.equal(filePath);
    });

    it('should return undefined if file not found', () => {
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
