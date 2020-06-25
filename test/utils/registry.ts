/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'path';
import { expect } from 'chai';
import * as util from '../../src/utils/registry';

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
});
