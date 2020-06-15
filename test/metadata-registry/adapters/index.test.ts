/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getAdapter, AdapterId } from '../../../src/metadata-registry/adapters';
import { expect, assert } from 'chai';
import { mockRegistry } from '../../mock/registry';
import { DefaultSourceAdapter } from '../../../src/metadata-registry/adapters/defaultSourceAdapter';
import { MixedContentSourceAdapter } from '../../../src/metadata-registry/adapters/mixedContentSourceAdapter';
import { MatchingContentSourceAdapter } from '../../../src/metadata-registry/adapters/matchingContentSourceAdapter';
import { BundleSourceAdapter } from '../../../src/metadata-registry/adapters/bundleSourceAdapter';
import { RegistryError } from '../../../src/errors';
import { nls } from '../../../src/i18n';
import { DecomposedSourceAdapter } from '../../../src/metadata-registry/adapters/decomposedSourceAdapter';

describe('SourceAdapters', () => {
  describe('getAdapter', () => {
    // the types being passed to getAdapter don't really matter in these tests. We're
    // just making sure that the adapter is instantiated correctly based on given inputs
    it('Should return DefaultSourceAdapter for undefined AdapterId', () => {
      const type = mockRegistry.types.kathybates;
      const adapter = getAdapter(type, undefined);
      expect(adapter).to.deep.equal(new DefaultSourceAdapter(type));
    });

    it('Should return MixedContentSourceAdapter for mixedContent AdapterId', () => {
      const type = mockRegistry.types.dwaynejohnson;
      const adapter = getAdapter(type, AdapterId.MixedContent);
      expect(adapter).to.deep.equal(new MixedContentSourceAdapter(type));
    });

    it('Should return MatchingContentSourceAdapter for matchingContentFile AdapterId', () => {
      const type = mockRegistry.types.keanureeves;
      const adapter = getAdapter(type, AdapterId.MatchingContentFile);
      expect(adapter).to.deep.equal(new MatchingContentSourceAdapter(type));
    });

    it('Should return BundleSourceAdapter for bundle AdapterId', () => {
      const type = mockRegistry.types.simonpegg;
      const adapter = getAdapter(type, AdapterId.Bundle);
      expect(adapter).to.deep.equal(new BundleSourceAdapter(type));
    });

    it('Should return DecomposedSourceAdapter for decomposed AdapterId', () => {
      const type = mockRegistry.types.reginaking;
      const adapter = getAdapter(type, AdapterId.Decomposed);
      expect(adapter).to.deep.equal(new DecomposedSourceAdapter(type));
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

  require('./defaultSourceAdapter');
  require('./matchingContentSourceAdapter');
  require('./mixedContentSourceAdapter');
  require('./bundleSourceAdapter');
  require('./decomposedSourceAdapter');
});
