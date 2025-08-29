/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { join } from 'node:path';
import { expect } from 'chai';
import { META_XML_SUFFIX } from '../../src/common';
import { parseMetadataXml, trimUntil, baseName, parseNestedFullName, baseWithoutSuffixes } from '../../src/utils';
import { MetadataType } from '../../src/registry/types';

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
    const mdTypeCommon: MetadataType = {
      id: 'test',
      name: 'Test',
      directoryName: 'tests',
    };
    const mdType: MetadataType = {
      ...mdTypeCommon,
      suffix: 'xyz',
    };
    const mdTypeLegacySuffix: MetadataType = {
      ...mdType,
      suffix: 'xyz',
      legacySuffix: 'xyzz',
    };

    it('Should strip specified suffixes from a file path with a dot', () => {
      const path = join(root, 'a.ext.xyz');
      expect(baseWithoutSuffixes(path, mdType)).to.equal('a.ext');
    });

    it('Should strip specified suffixes from a file path with a dot and standard ending', () => {
      const path = join(root, `a.ext.xyz${META_XML_SUFFIX}`);
      expect(baseWithoutSuffixes(path, mdType)).to.equal('a.ext');
    });

    it('Should handle paths with no suffixes', () => {
      const path = join(root, 'a');
      expect(baseWithoutSuffixes(path, mdTypeCommon)).to.equal('a');
    });

    it('Should preserve non-matching suffixes', () => {
      const path = join(root, 'a.xyz');
      expect(baseWithoutSuffixes(path, mdTypeCommon)).to.equal('a.xyz');
    });

    it('Should remove the standard suffix and a custom suffix', () => {
      const path = join(root, `a.xyz${META_XML_SUFFIX}`);
      expect(baseWithoutSuffixes(path, mdType)).to.equal('a');
    });

    it('should remove a legacy suffix', () => {
      const path = join(root, 'a.xyzz');
      expect(baseWithoutSuffixes(path, mdTypeLegacySuffix)).to.equal('a');
    });

    it('should remove a legacy suffix with the standard meta', () => {
      const path = join(root, `a.xyzz${META_XML_SUFFIX}`);
      expect(baseWithoutSuffixes(path, mdTypeLegacySuffix)).to.equal('a');
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
