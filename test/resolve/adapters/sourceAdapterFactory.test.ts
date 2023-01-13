/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { assert, expect } from 'chai';
import { Messages, SfError } from '@salesforce/core';
import { MetadataType, registry, RegistryAccess, VirtualTreeContainer } from '../../../src';
import {
  BundleSourceAdapter,
  DecomposedSourceAdapter,
  DefaultSourceAdapter,
  MatchingContentSourceAdapter,
  MixedContentSourceAdapter,
} from '../../../src/resolve/adapters';
import { SourceAdapterFactory } from '../../../src/resolve/adapters/sourceAdapterFactory';
import { DigitalExperienceSourceAdapter } from '../../../src/resolve/adapters/digitalExperienceSourceAdapter';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.load('@salesforce/source-deploy-retrieve', 'sdr', ['error_missing_adapter']);

/**
 * The types being passed to getAdapter don't really matter in these tests. We're
 * just making sure that the adapter is instantiated correctly based on their registry
 * configuration.
 */
describe('SourceAdapterFactory', () => {
  const tree = new VirtualTreeContainer([]);
  const factory = new SourceAdapterFactory(undefined, tree);
  const registryAccess = new RegistryAccess();

  it('Should return DefaultSourceAdapter for type with no assigned AdapterId', () => {
    const type = registry.types.reportfolder;
    const adapter = factory.getAdapter(type);
    expect(adapter).to.deep.equal(new DefaultSourceAdapter(type, registryAccess, undefined, tree));
  });

  it('Should return DefaultSourceAdapter for default AdapterId', () => {
    const type = registry.types.customlabels;
    const adapter = factory.getAdapter(type);
    expect(adapter).to.deep.equal(new DefaultSourceAdapter(type, registryAccess, undefined, tree));
  });

  it('Should return MixedContentSourceAdapter for mixedContent AdapterId', () => {
    const type = registry.types.staticresource;
    const adapter = factory.getAdapter(type);
    expect(adapter).to.deep.equal(new MixedContentSourceAdapter(type, registryAccess, undefined, tree));
    tree;
  });

  it('Should return MatchingContentSourceAdapter for matchingContentFile AdapterId', () => {
    const type = registry.types.apexclass;
    const adapter = factory.getAdapter(type);
    expect(adapter).to.deep.equal(new MatchingContentSourceAdapter(type, registryAccess, undefined, tree));
  });

  it('Should return DigitalExperienceSourceAdapter for digitalExperience AdapterId', () => {
    const type = registry.types.digitalexperiencebundle;
    const adapter = factory.getAdapter(type);
    expect(adapter).to.deep.equal(new DigitalExperienceSourceAdapter(type, registryAccess, undefined, tree));

    const childType = registry.types.digitalexperiencebundle.children.types.digitalexperience;
    const childAdapter = factory.getAdapter(childType);
    expect(childAdapter).to.deep.equal(new DigitalExperienceSourceAdapter(childType, registryAccess, undefined, tree));
  });

  it('Should return BundleSourceAdapter for bundle AdapterId', () => {
    const type = registry.types.auradefinitionbundle;
    const adapter = factory.getAdapter(type);
    expect(adapter).to.deep.equal(new BundleSourceAdapter(type, registryAccess, undefined, tree));
  });

  it('Should return DecomposedSourceAdapter for decomposed AdapterId', () => {
    const type = registry.types.customobject;
    const adapter = factory.getAdapter(type);
    expect(adapter).to.deep.equal(new DecomposedSourceAdapter(type, registryAccess, undefined, tree));
  });

  it('Should throw RegistryError for missing adapter', () => {
    const type: MetadataType = {
      directoryName: 'myTypes',
      // @ts-ignore
      strategies: { adapter: 'missingAdapter' },
      name: 'myType',
      id: 'mytype',
    };

    assert.throws(
      () => factory.getAdapter(type),
      SfError,
      messages.getMessage('error_missing_adapter', [type.strategies.adapter, type.name])
    );
  });
});
