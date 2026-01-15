/*
 * Copyright 2026, Salesforce, Inc.
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
import { assert, expect } from 'chai';
import { Messages, SfError } from '@salesforce/core';
import { MetadataType, presetMap, registry, RegistryAccess, VirtualTreeContainer } from '../../../src';
import {
  BundleSourceAdapter,
  DecomposedSourceAdapter,
  DefaultSourceAdapter,
  MatchingContentSourceAdapter,
  MixedContentSourceAdapter,
  WebApplicationsSourceAdapter,
} from '../../../src/resolve/adapters';
import { SourceAdapterFactory } from '../../../src/resolve/adapters/sourceAdapterFactory';
import { DigitalExperienceSourceAdapter } from '../../../src/resolve/adapters';
import { PartialDecomposedAdapter } from '../../../src/resolve/adapters/partialDecomposedAdapter';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

/**
 * The types being passed to getAdapter don't really matter in these tests. We're
 * just making sure that the adapter is instantiated correctly based on their registry
 * configuration.
 */
describe('SourceAdapterFactory', () => {
  const tree = new VirtualTreeContainer([]);
  const registryAccess = new RegistryAccess();
  const factory = new SourceAdapterFactory(registryAccess, tree);

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
  });

  it('Should return PartiallyDecomposedAdapter for partiallyDecomposed AdapterId', () => {
    const type = presetMap.get('decomposeExternalServiceRegistrationBeta');
    const adapter = factory.getAdapter(type!.types['externalserviceregistration']);
    // unable to deep.equal asserts because of different registries loaded with preset value
    expect(adapter instanceof PartialDecomposedAdapter).to.be.true;
  });

  it('Should return MatchingContentSourceAdapter for matchingContentFile AdapterId', () => {
    const type = registry.types.apexclass;
    const adapter = factory.getAdapter(type);
    expect(adapter).to.deep.equal(new MatchingContentSourceAdapter(type, registryAccess, undefined, tree));
  });

  it('Should return DigitalExperienceSourceAdapter for digitalExperience AdapterId', () => {
    assert(registry.types.digitalexperiencebundle.children?.types.digitalexperience);

    const type = registry.types.digitalexperiencebundle;
    const adapter = factory.getAdapter(type);
    expect(adapter).to.deep.equal(new DigitalExperienceSourceAdapter(type, registryAccess, undefined, tree));

    const childType = registry.types.digitalexperiencebundle.children.types.digitalexperience;
    const childAdapter = factory.getAdapter(childType);
    expect(childAdapter).to.deep.equal(new DigitalExperienceSourceAdapter(childType, registryAccess, undefined, tree));
  });

  it('Should return WebApplicationsSourceAdapter for webApplications AdapterId', () => {
    const type = registry.types.webapplication;
    const adapter = factory.getAdapter(type);
    expect(adapter).to.deep.equal(new WebApplicationsSourceAdapter(type, registryAccess, undefined, tree));
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
      messages.getMessage('error_missing_adapter', [type.strategies?.adapter, type.name])
    );
  });
});
