/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { mockRegistry, mockRegistryData, simon } from '../../mock/registry';
import { expect } from 'chai';
import { BundleSourceAdapter } from '../../../src/metadata-registry/adapters/bundleSourceAdapter';
import { basename } from 'path';
import { VirtualTreeContainer } from '../../../src/metadata-registry/treeContainers';
import { SIMON_XML_NAME } from '../../mock/registry/simonConstants';
import { SourceComponent } from '../../../src/metadata-registry';

describe('BundleSourceAdapter', () => {
  const {
    SIMON_BUNDLE_PATH,
    SIMON_XML_PATH,
    SIMON_SOURCE_PATHS,
    SIMON_DIR,
    SIMON_COMPONENT,
  } = simon;
  const type = mockRegistryData.types.simonpegg;
  const tree = new VirtualTreeContainer([
    {
      dirPath: SIMON_DIR,
      children: [basename(SIMON_BUNDLE_PATH)],
    },
    {
      dirPath: SIMON_BUNDLE_PATH,
      children: [SIMON_XML_NAME, ...SIMON_SOURCE_PATHS.map((p) => basename(p))],
    },
  ]);
  const adapter = new BundleSourceAdapter(type, mockRegistry, undefined, tree);
  const expectedComponent = new SourceComponent(SIMON_COMPONENT, tree);

  it('Should return expected SourceComponent when given a root metadata xml path', () => {
    expect(adapter.getComponent(SIMON_XML_PATH)).to.deep.equal(expectedComponent);
  });

  it('Should return expected SourceComponent when given a source path', () => {
    const randomSource =
      SIMON_SOURCE_PATHS[Math.floor(Math.random() * Math.floor(SIMON_SOURCE_PATHS.length))];
    expect(adapter.getComponent(randomSource)).to.deep.equal(expectedComponent);
  });
});
