/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { registry, VirtualTreeContainer } from '../../../src';
import {
  BundleSourceAdapter,
  DecomposedSourceAdapter,
  DefaultSourceAdapter,
  MatchingContentSourceAdapter,
  MixedContentSourceAdapter,
} from '../../../src/resolve/adapters';
import { SourceAdapterFactory } from '../../../src/resolve/adapters/sourceAdapterFactory';

/**
 * The types being passed to getAdapter don't really matter in these tests. We're
 * just making sure that the adapter is instantiated correctly based on their registry
 * configuration.
 */
describe('SourceAdapterFactory', () => {
  const tree = new VirtualTreeContainer([]);
  const factory = new SourceAdapterFactory(undefined, tree);

  it('Should return DefaultSourceAdapter for type with no assigned AdapterId', () => {
    const type = registry.types.reportfolder;
    const adapter = factory.getAdapter(type);
    expect(adapter).to.deep.equal(new DefaultSourceAdapter(type, undefined, undefined, tree));
  });

  it('Should return DefaultSourceAdapter for default AdapterId', () => {
    const type = registry.types.customlabels;
    const adapter = factory.getAdapter(type);
    expect(adapter).to.deep.equal(new DefaultSourceAdapter(type, undefined, undefined, tree));
  });

  it('Should return MixedContentSourceAdapter for mixedContent AdapterId', () => {
    const type = registry.types.staticresource;
    const adapter = factory.getAdapter(type);
    expect(adapter).to.deep.equal(new MixedContentSourceAdapter(type, undefined, undefined, tree));
    tree;
  });

  it('Should return MatchingContentSourceAdapter for matchingContentFile AdapterId', () => {
    const type = registry.types.apexclass;
    const adapter = factory.getAdapter(type);
    expect(adapter).to.deep.equal(new MatchingContentSourceAdapter(type, undefined, undefined, tree));
  });

  it('Should return BundleSourceAdapter for bundle AdapterId', () => {
    const type = registry.types.auradefinitionbundle;
    const adapter = factory.getAdapter(type);
    expect(adapter).to.deep.equal(new BundleSourceAdapter(type, undefined, undefined, tree));
  });

  it('Should return DecomposedSourceAdapter for decomposed AdapterId', () => {
    const type = registry.types.customobject;
    const adapter = factory.getAdapter(type);
    expect(adapter).to.deep.equal(new DecomposedSourceAdapter(type, undefined, undefined, tree));
  });
});
