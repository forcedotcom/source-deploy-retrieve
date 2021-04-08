/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { mockRegistry, mockRegistryData } from '../../mock/registry';
import { expect, assert } from 'chai';
import { DefaultSourceAdapter } from '../../../src/resolve/adapters/defaultSourceAdapter';
import { MixedContentSourceAdapter } from '../../../src/resolve/adapters/mixedContentSourceAdapter';
import { MatchingContentSourceAdapter } from '../../../src/resolve/adapters/matchingContentSourceAdapter';
import { BundleSourceAdapter } from '../../../src/resolve/adapters/bundleSourceAdapter';
import { DecomposedSourceAdapter } from '../../../src/resolve/adapters/decomposedSourceAdapter';
import { RegistryError } from '../../../src/errors';
import { nls } from '../../../src/i18n';
import { SourceAdapterFactory } from '../../../src/resolve/adapters/sourceAdapterFactory';
import { VirtualTreeContainer } from '../../../src/resolve';

/**
 * The types being passed to getAdapter don't really matter in these tests. We're
 * just making sure that the adapter is instantiated correctly based on their registry
 * configuration.
 */
describe('SourceAdapterFactory', () => {
  const tree = new VirtualTreeContainer([]);
  const factory = new SourceAdapterFactory(mockRegistry, tree);

  it('Should return DefaultSourceAdapter for type with no assigned AdapterId', () => {
    const type = mockRegistryData.types.xmlinfolder;
    const adapter = factory.getAdapter(type);
    expect(adapter).to.deep.equal(new DefaultSourceAdapter(type, mockRegistry, undefined, tree));
  });

  it('Should return DefaultSourceAdapter for default AdapterId', () => {
    const type = mockRegistryData.types.nondecomposed;
    const adapter = factory.getAdapter(type);
    expect(adapter).to.deep.equal(new DefaultSourceAdapter(type, mockRegistry, undefined, tree));
  });

  it('Should return MixedContentSourceAdapter for mixedContent AdapterId', () => {
    const type = mockRegistryData.types.mixedcontentsinglefile;
    const adapter = factory.getAdapter(type);
    expect(adapter).to.deep.equal(
      new MixedContentSourceAdapter(type, mockRegistry, undefined, tree)
    );
    tree;
  });

  it('Should return MatchingContentSourceAdapter for matchingContentFile AdapterId', () => {
    const type = mockRegistryData.types.matchingcontentfile;
    const adapter = factory.getAdapter(type);
    expect(adapter).to.deep.equal(
      new MatchingContentSourceAdapter(type, mockRegistry, undefined, tree)
    );
  });

  it('Should return BundleSourceAdapter for bundle AdapterId', () => {
    const type = mockRegistryData.types.bundle;
    const adapter = factory.getAdapter(type);
    expect(adapter).to.deep.equal(new BundleSourceAdapter(type, mockRegistry, undefined, tree));
  });

  it('Should return DecomposedSourceAdapter for decomposed AdapterId', () => {
    const type = mockRegistryData.types.reginaking;
    const adapter = factory.getAdapter(type);
    expect(adapter).to.deep.equal(new DecomposedSourceAdapter(type, mockRegistry, undefined, tree));
  });

  it('Should throw RegistryError for missing adapter', () => {
    const type = mockRegistryData.types.missingstrategies;
    assert.throws(
      () => factory.getAdapter(type),
      RegistryError,
      nls.localize('error_missing_adapter', [type.strategies.adapter, type.name])
    );
  });
});
