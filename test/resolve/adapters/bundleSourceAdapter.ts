/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { bundle } from '../../mock';
import { BundleSourceAdapter } from '../../../src/resolve/adapters';
import { CONTENT_PATH } from '../../mock/type-constants/auraBundleConstant';
import { RegistryAccess } from '../../../src';

describe('BundleSourceAdapter', () => {
  const registryAccess = new RegistryAccess();
  const adapter = new BundleSourceAdapter(bundle.COMPONENT.type, registryAccess, undefined, bundle.COMPONENT.tree);

  it('Should return expected SourceComponent when given a root metadata xml path', () => {
    expect(adapter.getComponent(bundle.XML_PATH)).to.deep.equal(bundle.COMPONENT);
  });

  it('Should return expected SourceComponent when given a bundle directory', () => {
    expect(adapter.getComponent(bundle.CONTENT_PATH)).to.deep.equal(bundle.COMPONENT);
  });

  it('Should exclude empty bundle directories', () => {
    const emptyBundleAdapter = new BundleSourceAdapter(
      bundle.EMPTY_BUNDLE.type,
      registryAccess,
      undefined,
      bundle.EMPTY_BUNDLE.tree
    );
    expect(emptyBundleAdapter.getComponent(CONTENT_PATH)).to.be.undefined;
  });

  it('Should return expected SourceComponent when given a source path', () => {
    const randomSource = bundle.SOURCE_PATHS[1];
    expect(adapter.getComponent(randomSource)).to.deep.equal(bundle.COMPONENT);
  });
});
