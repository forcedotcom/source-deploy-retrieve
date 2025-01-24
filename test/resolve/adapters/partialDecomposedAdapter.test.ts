/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { MetadataRegistry, RegistryAccess, SourceComponent, VirtualTreeContainer } from '../../../src';
import * as decomposeExternalServiceRegistrationBeta from '../../../src/registry/presets/decomposeExternalServiceRegistrationBeta.json';
import { decomposeExternalServiceRegistration } from '../../mock/type-constants';
import { PartialDecomposedAdapter } from '../../../src/resolve/adapters/partialDecomposedAdapter';

describe('PartialDecomposedAdapter', () => {
  const registryAccess = new RegistryAccess(decomposeExternalServiceRegistrationBeta as MetadataRegistry);
  const type = registryAccess.getTypeByName('externalserviceregistration');
  const { CHILD_YAML, TYPE_DIRECTORY, SOURCE_META_FILE } = decomposeExternalServiceRegistration;
  const tree = new VirtualTreeContainer([
    {
      dirPath: TYPE_DIRECTORY,
      children: [SOURCE_META_FILE, CHILD_YAML],
    },
  ]);
  const expectedComponent = new SourceComponent({ name: 'myESR', xml: SOURCE_META_FILE, type }, tree);
  const adapter = new PartialDecomposedAdapter(type, registryAccess, undefined, tree);

  it('Should return expected SourceComponent when given a -meta.xml path', () => {
    expect(adapter.getComponent(SOURCE_META_FILE)).to.deep.equal(expectedComponent);
  });

  it('Should return expected SourceComponent when given a child path', () => {
    const ec = new SourceComponent({ name: 'myESR', type, xml: SOURCE_META_FILE }, tree);
    const adapter = new PartialDecomposedAdapter(type.children!.types['yaml'], registryAccess, undefined, tree);
    expect(adapter.getComponent(CHILD_YAML)).to.deep.equal(ec);
  });
});
