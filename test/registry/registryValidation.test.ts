/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { MetadataRegistry } from '../../src';
import { registry as defaultRegistry } from '../../src/registry/registry';

describe('Registry Validation', () => {
  describe('every child type has an entry in children', () => {
    const registry = defaultRegistry as MetadataRegistry;
    const childMapping = new Map<string, string>();
    const typesWithChildren = Object.values(registry.types).filter((type) => type.children);

    typesWithChildren.map((parentType) =>
      Object.values(parentType.children.types).map((childType) => {
        childMapping.set(childType.id, parentType.id);
      })
    );

    childMapping.forEach((parentId, childId) => {
      it(`has a childType for ${childId} : ${parentId}`, () => {
        expect(parentId).to.be.a('string');
        expect(childId).to.be.a('string');
        expect(registry.childTypes[childId]).to.equal(parentId);
      });
    });
  });
});
