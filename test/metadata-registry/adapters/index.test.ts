/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getAdapter, AdapterId } from '../../../src/metadata-registry/adapters';
import { expect, assert } from 'chai';
import { mockRegistry } from '../../mock/registry';
import { BaseSourceAdapter } from '../../../src/metadata-registry/adapters/base';
import { MixedContent } from '../../../src/metadata-registry/adapters/mixedContent';
import { MatchingContentFile } from '../../../src/metadata-registry/adapters/matchingContentFile';
import { Bundle } from '../../../src/metadata-registry/adapters/bundle';
import { RegistryError } from '../../../src/errors';
import { nls } from '../../../src/i18n';
import { Decomposed } from '../../../src/metadata-registry/adapters/decomposed';

describe('SourceAdapters', () => {
  describe('getAdapter', () => {
    // the types being passed to getAdapter don't really matter in these tests. We're
    // just making sure that the adapter is instantiated correctly based on given inputs
    it('Should return BaseSourceAdapter for undefined AdapterId', () => {
      const type = mockRegistry.types.kathybates;
      const adapter = getAdapter(type, undefined);
      expect(adapter).to.deep.equal(new BaseSourceAdapter(type));
    });

    it('Should return MixedContent for mixedContent AdapterId', () => {
      const type = mockRegistry.types.dwaynejohnson;
      const adapter = getAdapter(type, AdapterId.MixedContent);
      expect(adapter).to.deep.equal(new MixedContent(type));
    });

    it('Should return MatchingContentFile for matchingContentFile AdapterId', () => {
      const type = mockRegistry.types.keanureeves;
      const adapter = getAdapter(type, AdapterId.MatchingContentFile);
      expect(adapter).to.deep.equal(new MatchingContentFile(type));
    });

    it('Should return Bundle for bundle AdapterId', () => {
      const type = mockRegistry.types.simonpegg;
      const adapter = getAdapter(type, AdapterId.Bundle);
      expect(adapter).to.deep.equal(new Bundle(type));
    });

    it('Should return Decomposed for decomposed AdapterId', () => {
      const type = mockRegistry.types.reginaking;
      const adapter = getAdapter(type, AdapterId.Decomposed);
      expect(adapter).to.deep.equal(new Decomposed(type));
    });

    it('Should throw RegistryError for missing adapter', () => {
      const type = mockRegistry.types.tarajihenson;
      const invalidId = 'asdf' as AdapterId;
      assert.throws(
        () => getAdapter(type, invalidId),
        RegistryError,
        nls.localize('error_missing_adapter', [type.name, invalidId])
      );
    });
  });

  require('./base');
  require('./matchingContentFile');
  require('./mixedContent');
  require('./bundle');
  require('./decomposed');
});
