/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'path';
import { expect } from 'chai';
import * as util from '../../src/utils/registry';
import { createSandbox, SinonStub } from 'sinon';
import * as fs from 'fs';

const env = createSandbox();

describe('Registry Utils', () => {
  const root = join('path', 'to', 'whatever');
  describe('parseMetadataXml', () => {
    it('Should parse fullName and suffix from metadata xml path', () => {
      const path = join(root, 'a.ext-meta.xml');
      expect(util.parseMetadataXml(path)).to.deep.equal({
        fullName: 'a',
        path,
        suffix: 'ext'
      });
    });

    it('Should return undefined for file name not in metadata xml format', () => {
      const path = join(root, 'a.ext');
      expect(util.parseMetadataXml(path)).to.be.undefined;
    });
  });

  describe('find', () => {
    let readStub: SinonStub;
    const files = ['a.q', 'a.x-meta.xml', 'b', 'b.x-meta.xml', 'c.z', 'c.x-meta.xml'];
    before(() => {
      readStub = env.stub(fs, 'readdirSync');
      readStub.withArgs(root).returns(files);
    });
    after(() => env.restore());

    it('Should find a metadata xml file by fullName in a directory', () => {
      expect(util.findMetadataXml(root, 'b')).to.equal(join(root, 'b.x-meta.xml'));
    });

    it('Should find a content file by fullName in a directory', () => {
      expect(util.findMetadataContent(root, 'c')).to.equal(join(root, 'c.z'));
    });
  });
});
