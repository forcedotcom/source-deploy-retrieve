/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { bundle, lwcBundle } from '../../mock';
import { getBundleComponent } from '../../../src/resolve/adapters/bundleSourceAdapter';
import { CONTENT_PATH } from '../../mock/type-constants/auraBundleConstant';
import { CONTENT_PATH as LWC_CONTENT_PATH } from '../../mock/type-constants/lwcBundleConstant';
import { RegistryAccess } from '../../../src';

describe('BundleSourceAdapter with AuraBundle', () => {
  const registryAccess = new RegistryAccess();
  describe('non-empty', () => {
    const adapter = getBundleComponent({ registry: registryAccess, tree: bundle.COMPONENT.tree });
    const type = bundle.COMPONENT.type;
    it('Should return expected SourceComponent when given a root metadata xml path', () => {
      expect(adapter({ path: bundle.XML_PATH, type })).to.deep.equal(bundle.COMPONENT);
    });

    it('Should return expected SourceComponent when given a bundle directory', () => {
      expect(adapter({ path: bundle.CONTENT_PATH, type })).to.deep.equal(bundle.COMPONENT);
    });

    it('Should return expected SourceComponent when given a source path', () => {
      const randomSource = bundle.SOURCE_PATHS[1];
      expect(adapter({ path: randomSource, type })).to.deep.equal(bundle.COMPONENT);
    });
  });

  it('Should exclude empty bundle directories', () => {
    const type = bundle.EMPTY_BUNDLE.type;
    const adapter = getBundleComponent({
      registry: registryAccess,
      tree: bundle.EMPTY_BUNDLE.tree,
    });
    expect(adapter({ path: CONTENT_PATH, type })).to.be.undefined;
  });

  describe('deeply nested LWC', () => {
    const type = lwcBundle.COMPONENT.type;
    const lwcAdapter = getBundleComponent({
      registry: registryAccess,
      tree: lwcBundle.COMPONENT.tree,
    });
    it('Should return expected SourceComponent when given a root metadata xml path', () => {
      expect(lwcAdapter({ type, path: lwcBundle.XML_PATH })).to.deep.equal(lwcBundle.COMPONENT);
    });

    it('Should return expected SourceComponent when given a lwcBundle directory', () => {
      expect(lwcAdapter({ type, path: lwcBundle.CONTENT_PATH })).to.deep.equal(lwcBundle.COMPONENT);
    });

    it('Should return expected SourceComponent when given a source path', () => {
      const randomSource = lwcBundle.SOURCE_PATHS[1];
      expect(lwcAdapter({ type, path: randomSource })).to.deep.equal(lwcBundle.COMPONENT);
    });

    it('Should exclude nested empty bundle directories', () => {
      const type = lwcBundle.EMPTY_BUNDLE.type;
      const emptyBundleAdapter = getBundleComponent({
        registry: registryAccess,
        tree: lwcBundle.EMPTY_BUNDLE.tree,
      });
      expect(emptyBundleAdapter({ type, path: LWC_CONTENT_PATH })).to.be.undefined;
    });
  });
});
