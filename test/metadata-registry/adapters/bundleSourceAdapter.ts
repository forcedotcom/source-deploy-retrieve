/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { mockRegistry, bundle } from '../../mock/registry';
import { expect } from 'chai';
import { BundleSourceAdapter } from '../../../src/resolve/adapters/bundleSourceAdapter';

describe('BundleSourceAdapter', () => {
  const adapter = new BundleSourceAdapter(
    bundle.COMPONENT.type,
    mockRegistry,
    undefined,
    bundle.COMPONENT.tree
  );

  it('Should return expected SourceComponent when given a root metadata xml path', () => {
    expect(adapter.getComponent(bundle.XML_PATH)).to.deep.equal(bundle.COMPONENT);
  });

  it('Should return expected SourceComponent when given a source path', () => {
    const randomSource = bundle.SOURCE_PATHS[1];
    expect(adapter.getComponent(randomSource)).to.deep.equal(bundle.COMPONENT);
  });
});
