/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'node:path';
import { SinonStub, createSandbox } from 'sinon';
import { expect, config } from 'chai';
import fs from 'graceful-fs';
import { ensureFileExists, searchUp } from '../../src/utils/fileSystemHandler';

const env = createSandbox();
config.truncateThreshold = 0;
describe('File System Utils', () => {
  const root = join(process.cwd(), 'path', 'to', 'whatever');

  afterEach(() => env.restore());

  describe('searchUp', () => {
    let existsStub: SinonStub;
    const filename = 'test.x';
    const filePath = join(root, filename);
    const startPath = join(root, 'a', 'more', 'nested', 'file.y');

    beforeEach(() => {
      existsStub = env.stub(fs, 'existsSync');
      existsStub.returns(false);
    });

    it('should traverse up and find a file with the given file name', () => {
      existsStub.withArgs(filePath).returns(true);
      expect(searchUp(startPath, filename)).to.equal(filePath);
    });

    it('should return start path if it is the file being searched for', () => {
      existsStub.withArgs(filePath).returns(true);
      expect(searchUp(filePath, filename)).to.equal(filePath);
    });

    it('should return undefined if file not found', () => {
      expect(searchUp(startPath, 'asdf')).to.be.undefined;
    });
  });

  describe('ensureFileExists', () => {
    it('should ensure file exists', () => {
      const mkdirStub = env.stub(fs, 'mkdirSync');

      const path = join('path', 'to', 'a', 'file.x');
      const closeStub = env.stub(fs, 'closeSync');
      const openStub = env.stub(fs, 'openSync');
      openStub.returns(123);

      ensureFileExists(path);

      // somewhat validating ensureDirectoryExists was called first
      expect(mkdirStub.calledBefore(openStub)).to.be.true;
      expect(closeStub.firstCall.args[0]).to.equal(123);
    });
  });
});
