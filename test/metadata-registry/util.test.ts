/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'path';
import { expect } from 'chai';
import * as util from '../../src/metadata-registry/util';
import { createSandbox, SinonStub } from 'sinon';
import * as fs from 'fs';

const env = createSandbox();

describe('Metadata Registry Util', () => {
  const root = join('path', 'to', 'whatever');
  describe('parseMetadataXml', () => {
    it('Should parse fullName and suffix from metadata xml path', () => {
      const path = join(root, 'a.ext-meta.xml');
      expect(util.parseMetadataXml(path)).to.deep.equal({
        fullName: 'a',
        suffix: 'ext'
      });
    });

    it('Should return undefined for file name not in metadata xml format', () => {
      const path = join(root, 'a.ext');
      expect(util.parseMetadataXml(path)).to.be.undefined;
    });
  });

  describe('parseBaseName', () => {
    it('Should strip all suffixes of a file path and return just the name', () => {
      const path = join(root, 'a.ext.xyz');
      expect(util.parseBaseName(path)).to.equal('a');
    });

    it('Should handle paths with no suffixes', () => {
      const path = join(root, 'a');
      expect(util.parseBaseName(path)).to.equal('a');
    });
  });

  describe('isDirectory', () => {
    it('Should utilize fs Stats to determine if path is a directory', () => {
      const statStub = env.stub(fs, 'lstatSync');
      // @ts-ignore
      statStub.withArgs(root).returns({ isDirectory: () => true });
      expect(util.isDirectory(root)).to.be.true;
    });
  });

  describe('find', () => {
    let readStub: SinonStub;
    const files = [
      'a.q',
      'a.x-meta.xml',
      'b',
      'b.x-meta.xml',
      'c.z',
      'c.x-meta.xml'
    ];
    before(() => {
      readStub = env.stub(fs, 'readdirSync');
      readStub.withArgs(root).returns(files);
    });
    after(() => env.restore());

    it('Should find a metadata xml file by fullName in a directory', () => {
      expect(util.findMetadataXml(root, 'b')).to.equal(
        join(root, 'b.x-meta.xml')
      );
    });

    it('Should find a content file by fullName in a directory', () => {
      expect(util.findMetadataContent(root, 'c')).to.equal(join(root, 'c.z'));
    });
  });

  describe('walk', () => {
    let readStub: SinonStub;
    let statStub: SinonStub;

    beforeEach(() => {
      readStub = env.stub(fs, 'readdirSync');
      statStub = env.stub(fs, 'lstatSync');
    });
    afterEach(() => env.restore());

    const files = ['a.x', 'b.y', 'c.z'];

    it('Should collect all files in single level directory', () => {
      statStub.returns({ isDirectory: () => false });
      readStub.withArgs(root).returns(files);

      expect(util.walk(root)).to.deep.equal(files.map(f => join(root, f)));
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

      expect(util.walk(root)).to.deep.equal([
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

      expect(util.walk(root, ignore)).to.deep.equal([
        join(root, 'a.x'),
        join(root, 'c.z')
      ]);
    });
  });
});
