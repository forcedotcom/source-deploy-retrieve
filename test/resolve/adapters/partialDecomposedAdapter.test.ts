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
