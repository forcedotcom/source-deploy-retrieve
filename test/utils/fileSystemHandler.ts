/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { walk, isDirectory, searchUp } from '../../src/utils/fileSystemHandler';
import { SinonStub, createSandbox } from 'sinon';
import { expect } from 'chai';
import { join } from 'path';
import * as fs from 'fs';

const env = createSandbox();

describe('File System Utils', () => {
  const root = join('path', 'to', 'whatever');

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

      expect(walk(root)).to.deep.equal(files.map(f => join(root, f)));
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

      expect(walk(root)).to.deep.equal([
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

      expect(walk(root, ignore)).to.deep.equal([
        join(root, 'a.x'),
        join(root, 'c.z')
      ]);
    });
  });

  describe('isDirectory', () => {
    it('Should utilize fs Stats to determine if path is a directory', () => {
      const statStub = env.stub(fs, 'lstatSync');
      // @ts-ignore
      statStub.withArgs(root).returns({ isDirectory: () => true });
      expect(isDirectory(root)).to.be.true;
    });
  });

  describe('searchUp', () => {
    let existsStub: SinonStub;
    const filePath = '/path/test.x';
    const startPath = '/path/to/a/more/nested/file.y';

    beforeEach(() => {
      existsStub = env.stub(fs, 'existsSync');
      existsStub.returns(false);
    });

    it('Should traverse up and find a file with the given file name', () => {
      existsStub.withArgs(filePath).returns(true);
      expect(searchUp(startPath, 'test.x')).to.equal(filePath);
    });

    it('Should return start path if it is the file being searched for', () => {
      existsStub.withArgs(filePath).returns(true);
      expect(searchUp(filePath, 'test.x')).to.equal(filePath);
    });

    it('Should return undefined if file not found', () => {
      expect(searchUp(startPath, 'asdf')).to.be.undefined;
    });
  });
});
