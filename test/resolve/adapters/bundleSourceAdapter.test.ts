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

import { expect } from 'chai';
import { bundle, lwcBundle } from '../../mock';
import { BundleSourceAdapter } from '../../../src/resolve/adapters';
import { CONTENT_PATH } from '../../mock/type-constants/auraBundleConstant';
import { CONTENT_PATH as LWC_CONTENT_PATH } from '../../mock/type-constants/lwcBundleConstant';
import { RegistryAccess } from '../../../src';

describe('BundleSourceAdapter with AuraBundle', () => {
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

  describe('deeply nested LWC', () => {
    const lwcAdapter = new BundleSourceAdapter(
      lwcBundle.COMPONENT.type,
      registryAccess,
      undefined,
      lwcBundle.COMPONENT.tree
    );
    it('Should return expected SourceComponent when given a root metadata xml path', () => {
      expect(lwcAdapter.getComponent(lwcBundle.XML_PATH)).to.deep.equal(lwcBundle.COMPONENT);
    });

    it('Should return expected SourceComponent when given a lwcBundle directory', () => {
      expect(lwcAdapter.getComponent(lwcBundle.CONTENT_PATH)).to.deep.equal(lwcBundle.COMPONENT);
    });

    it('Should return expected SourceComponent when given a source path', () => {
      const randomSource = lwcBundle.SOURCE_PATHS[1];
      expect(lwcAdapter.getComponent(randomSource)).to.deep.equal(lwcBundle.COMPONENT);
    });

    it('Should exclude nested empty bundle directories', () => {
      const emptyBundleAdapter = new BundleSourceAdapter(
        lwcBundle.EMPTY_BUNDLE.type,
        registryAccess,
        undefined,
        lwcBundle.EMPTY_BUNDLE.tree
      );
      expect(emptyBundleAdapter.getComponent(LWC_CONTENT_PATH)).to.be.undefined;
    });
  });
});
