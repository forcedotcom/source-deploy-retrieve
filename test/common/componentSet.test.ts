/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { MetadataComponent, SourceComponent } from '../../src';
import { ComponentSet } from '../../src/common';
import { mockRegistry } from '../mock/registry';

describe('ComponentSet', () => {
  const dupeComponent: MetadataComponent = {
    fullName: 'TestDupe',
    type: mockRegistry.types.mixedcontentsinglefile,
  };
  const sourceComponents = [
    new SourceComponent({
      name: 'TestDupe',
      type: mockRegistry.types.mixedcontentsinglefile,
    }),
    // creating a copy to ensure it is deduped
    new SourceComponent({
      name: 'TestDupe',
      type: mockRegistry.types.mixedcontentsinglefile,
    }),
    new SourceComponent({
      name: 'Test2',
      type: mockRegistry.types.decomposedtoplevel,
    }),
  ];
  const set = new ComponentSet(sourceComponents);

  it('should not include duplicate components', () => {
    expect(Array.from(set.values())).to.deep.equal([sourceComponents[0], sourceComponents[2]]);
  });

  it('should return matching SourceComponent', () => {
    expect(set.get(dupeComponent)).to.deep.equal(sourceComponents[0]);
  });

  it('should correctly test component membership', () => {
    expect(set.has(dupeComponent)).to.be.true;
  });
});
