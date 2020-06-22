/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { mockRegistry } from '../../mock/registry';
import { expect, assert } from 'chai';
import { DefaultSourceAdapter } from '../../../src/metadata-registry/adapters/defaultSourceAdapter';
import { MixedContentSourceAdapter } from '../../../src/metadata-registry/adapters/mixedContentSourceAdapter';
import { MatchingContentSourceAdapter } from '../../../src/metadata-registry/adapters/matchingContentSourceAdapter';
import { BundleSourceAdapter } from '../../../src/metadata-registry/adapters/bundleSourceAdapter';
import { DecomposedSourceAdapter } from '../../../src/metadata-registry/adapters/decomposedSourceAdapter';
import { RegistryError } from '../../../src/errors';
import { nls } from '../../../src/i18n';
import { SourceAdapterFactory } from '../../../src/metadata-registry/adapters/sourceAdapterFactory';

describe('SourceAdapterFactory', () => {
  const factory = new SourceAdapterFactory(mockRegistry);

  // the types being passed to getAdapter don't really matter in these tests. We're
  // just making sure that the adapter is instantiated correctly based on given inputs
  it('Should return DefaultSourceAdapter for type with no assigned AdapterId', () => {
    const type = mockRegistry.types.kathybates;
    const adapter = factory.getAdapter(type);
    expect(adapter).to.deep.equal(new DefaultSourceAdapter(type, mockRegistry));
  });

  it('Should return MixedContentSourceAdapter for mixedContent AdapterId', () => {
    const type = mockRegistry.types.dwaynejohnson;
    const adapter = factory.getAdapter(type);
    expect(adapter).to.deep.equal(new MixedContentSourceAdapter(type, mockRegistry));
  });

  it('Should return MatchingContentSourceAdapter for matchingContentFile AdapterId', () => {
    const type = mockRegistry.types.keanureeves;
    const adapter = factory.getAdapter(type);
    expect(adapter).to.deep.equal(new MatchingContentSourceAdapter(type, mockRegistry));
  });

  it('Should return BundleSourceAdapter for bundle AdapterId', () => {
    const type = mockRegistry.types.simonpegg;
    const adapter = factory.getAdapter(type);
    expect(adapter).to.deep.equal(new BundleSourceAdapter(type, mockRegistry));
  });

  it('Should return DecomposedSourceAdapter for decomposed AdapterId', () => {
    const type = mockRegistry.types.reginaking;
    const adapter = factory.getAdapter(type);
    expect(adapter).to.deep.equal(new DecomposedSourceAdapter(type, mockRegistry));
  });

  it('Should throw RegistryError for missing adapter', () => {
    const type = mockRegistry.types.genewilder;
    assert.throws(
      () => factory.getAdapter(type),
      RegistryError,
      nls.localize('error_missing_adapter', [type.name, mockRegistry.adapters.genewilder])
    );
  });
});
