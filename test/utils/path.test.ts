/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'node:path';
import { expect } from 'chai';
import { META_XML_SUFFIX } from '../../src/common';
import { parseMetadataXml, trimUntil, baseName, parseNestedFullName, baseWithoutSuffixes } from '../../src/utils';

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

  describe('baseWithoutSuffixes', () => {
    it('Should strip specified suffixes from a file path with a dot', () => {
      const path = join(root, 'a.ext.xyz');
      expect(baseWithoutSuffixes(path, 'xyz')).to.equal('a.ext');
    });

    it('Should strip specified suffixes from a file path with a dot and standard ending', () => {
      const path = join(root, `a.ext.xyz${META_XML_SUFFIX}`);
      expect(baseWithoutSuffixes(path, 'xyz')).to.equal('a.ext');
    });

    it('Should handle paths with no suffixes', () => {
      const path = join(root, 'a');
      expect(baseWithoutSuffixes(path, 'ext')).to.equal('a');
    });

    it('Should preserve non-matching suffixes', () => {
      const path = join(root, 'a.xyz');
      expect(baseWithoutSuffixes(path, 'ext')).to.equal('a.xyz');
    });

    it('Should remove the standard suffix and a custom suffix', () => {
      const path = join(root, `a.ext${META_XML_SUFFIX}`);
      expect(baseWithoutSuffixes(path, 'ext')).to.equal('a');
    });
  });
  describe('trimUntil', () => {
    it('should return given path if part is not found', () => {
      expect(trimUntil(root, 'test')).to.equal(root);
    });

    it('should return trimmed path up until and including the given part', () => {
      expect(trimUntil(root, 'to')).to.equal(join('to', 'whatever'));
    });

    describe('until last', () => {
      const path = join('proj', 'lwc', 'folder1', 'lwc', 'myCmp');

      it('should return trimmed until first unless last is requested', () => {
        expect(trimUntil(path, 'lwc')).to.equal(join('lwc', 'folder1', 'lwc', 'myCmp'));
      });

      it('should return trimmed until last if requested', () => {
        expect(trimUntil(path, 'lwc', true)).to.equal(join('lwc', 'myCmp'));
      });
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

    it('handles paths with dots before the suffixes', () => {
      const path = join(root, 'a.b.ext-meta.xml');
      expect(parseMetadataXml(path)).to.deep.equal({
        fullName: 'a.b',
        path,
        suffix: 'ext',
      });
    });

    it('Should return undefined for file name not in metadata xml format', () => {
      const path = join(root, 'a.ext');
      expect(parseMetadataXml(path)).to.be.undefined;
    });
  });

  describe('parseNestedFullName', () => {
    it('should return fullName for deeply nested file in source format', () => {
      const expectedFullName = 'foo/bar';
      const filePath = join('force-app', 'main', 'default', 'reports', 'foo', 'bar.reportFolder-meta.xml');
      const dirName = 'reports';
      expect(parseNestedFullName(filePath, dirName)).to.equal(expectedFullName);
    });

    it('should return fullName for deeply nested file in mdapi format', () => {
      const expectedFullName = 'foo/bar/baz';
      const filePath = join('force-app', 'main', 'default', 'reports', 'foo', 'bar', 'baz-meta.xml');
      const dirName = 'reports';
      expect(parseNestedFullName(filePath, dirName)).to.equal(expectedFullName);
    });
  });
});
