/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'path';
import { expect } from 'chai';
import { parseMetadataXml, trimUntil, baseName } from '../../src/utils';

describe('Path Utils', () => {
  const root = join('path', 'to', 'whatever');

  describe('baseName', () => {
    it('Should strip all suffixes of a file path and return just the name', () => {
      const path = join(root, 'a.ext.xyz');
      expect(baseName(path)).to.equal('a');
    });

    it('Should handle paths with no suffixes', () => {
      const path = join(root, 'a');
      expect(baseName(path)).to.equal('a');
    });
  });

  describe('trimUntil', () => {
    it('should return given path if part is not found', () => {
      expect(trimUntil(root, 'test')).to.equal(root);
    });

    it('should return trimmed path up until and including the given part', () => {
      expect(trimUntil(root, 'to')).to.equal(join('to', 'whatever'));
    });
  });

  describe('parseMetadataXml', () => {
    it('Should parse fullName and suffix from metadata xml path', () => {
      const path = join(root, 'a.ext-meta.xml');
      expect(parseMetadataXml(path)).to.deep.equal({
        fullName: 'a',
        path,
        suffix: 'ext',
      });
    });

    it('Should return undefined for file name not in metadata xml format', () => {
      const path = join(root, 'a.ext');
      expect(parseMetadataXml(path)).to.be.undefined;
    });
  });
});
