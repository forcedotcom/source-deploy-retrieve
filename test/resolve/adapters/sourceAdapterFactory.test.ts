/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { assert, expect } from 'chai';
import { Messages, SfError } from '@salesforce/core';
import { MetadataType, registry } from '../../../src';

import { getMatchingContentComponent } from '../../../src/resolve/adapters/matchingContentSourceAdapter';
import { getBundleComponent } from '../../../src/resolve/adapters//bundleSourceAdapter';
import { getMixedContentComponent } from '../../../src/resolve/adapters//mixedContentSourceAdapter';
import { getDecomposedComponent } from '../../../src/resolve/adapters//decomposedSourceAdapter';
import { getDefaultComponent } from '../../../src/resolve/adapters//defaultSourceAdapter';
import { getDigitalExperienceComponent } from '../../../src/resolve/adapters//digitalExperienceSourceAdapter';

import { adapterSelector } from '../../../src/resolve/adapters/sourceAdapterFactory';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

/**
 * The types being passed to getAdapter don't really matter in these tests. We're
 * just making sure that the correct function is returns
 * configuration.
 */
describe('SourceAdapterFactory', () => {
  it('Should return DefaultSourceAdapter for type with no assigned AdapterId', () => {
    const adapter = adapterSelector(registry.types.reportfolder);
    expect(adapter).to.deep.equal(getDefaultComponent);
  });

  it('Should return DefaultSourceAdapter for default AdapterId', () => {
    const adapter = adapterSelector(registry.types.customlabels);
    expect(adapter).to.deep.equal(getDefaultComponent);
  });

  it('Should return MixedContentSourceAdapter for mixedContent AdapterId', () => {
    const adapter = adapterSelector(registry.types.staticresource);
    expect(adapter).to.deep.equal(getMixedContentComponent);
  });

  it('Should return MatchingContentSourceAdapter for matchingContentFile AdapterId', () => {
    const adapter = adapterSelector(registry.types.apexclass);
    expect(adapter).to.deep.equal(getMatchingContentComponent);
  });

  it('Should return DigitalExperienceSourceAdapter for digitalExperience AdapterId', () => {
    assert(registry.types.digitalexperiencebundle.children?.types.digitalexperience);

    const adapter = adapterSelector(registry.types.digitalexperiencebundle);
    expect(adapter).to.deep.equal(getDigitalExperienceComponent);

    const childAdapter = adapterSelector(registry.types.digitalexperiencebundle.children.types.digitalexperience);
    expect(childAdapter).to.deep.equal(getDigitalExperienceComponent);
  });

  it('Should return BundleSourceAdapter for bundle AdapterId', () => {
    const adapter = adapterSelector(registry.types.auradefinitionbundle);
    expect(adapter).to.deep.equal(getBundleComponent);
  });

  it('Should return DecomposedSourceAdapter for decomposed AdapterId', () => {
    const adapter = adapterSelector(registry.types.customobject);
    expect(adapter).to.deep.equal(getDecomposedComponent);
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
      () => adapterSelector(type),
      SfError,
      messages.getMessage('error_missing_adapter', [type.strategies?.adapter, type.name])
    );
  });
});
