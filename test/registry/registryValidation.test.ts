/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { MetadataRegistry } from '../../src';
import { registry as defaultRegistry } from '../../src/registry/registry';
import { MetadataType } from '../../src/registry/types';

describe('Registry Validation', () => {
  const registry = defaultRegistry as MetadataRegistry;
  const typesWithChildren = Object.values(registry.types).filter((type) => type.children);

  describe('every child type has an entry in children', () => {
    const childMapping = new Map<string, string>();

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

  describe('suffix object is complete', () => {
    const knownExceptions = [
      'DataSource', // both ExternalDataSource and DataSource use the suffix .dataSource :(
      'CustomLabel', // custom label (child of customLabel has suffix labels in types BUT has an entry in suffixes that points to customlabels )
      'CustomLabels', // custom label (child of customLabel has suffix labels in types BUT has an entry in suffixes that points to customlabels )
      'MatchingRules', // same suffix on MatchingRule and MatchingRules
      'MatchingRule', // same suffix on MatchingRule and MatchingRules
      // things that use the suffix .settings (!)
      'IndustriesManufacturingSettings',
      'ObjectHierarchyRelationship',
    ];

    const suffixMap = new Map<string, string>();
    Object.values(registry.types)
      .filter(
        (type) => type.suffix && !type.strictDirectoryName && !knownExceptions.includes(type.name)
      )
      .map((type) => {
        // mapping for the type's suffix
        suffixMap.set(type.suffix, type.id);
        if (type.children) {
          Object.values(type.children.types).map((childType) => {
            // mapping for the child's suffix
            suffixMap.set(childType.suffix, childType.id);
          });
        }
      });
    suffixMap.forEach((typeid, suffix) => {
      it(`has a suffix entry for "${suffix}" : "${typeid}"`, () => {
        expect(typeid).to.be.a('string');
        expect(suffix).to.be.a('string');
        expect(registry.suffixes[suffix]).to.equal(typeid);
      });
    });
  });

  describe('suffixes must be unique on non-strict types', () => {
    const suffixMap = new Map<string, MetadataType[]>();
    Object.values(registry.types).map((type) => {
      if (type.suffix) {
        // some bundle types have no suffix
        suffixMap.set(
          type.suffix,
          suffixMap.has(type.suffix) ? [...suffixMap.get(type.suffix), type] : [type]
        );
      }
    });
    suffixMap.forEach((types, suffix) => {
      if (types.length > 1) {
        // identify when a single suffix is used in multiple metadata types.
        // when the happens, there can only be one who is not marked as strictDirectoryName
        it(`Suffix "${suffix}" used by types (${types
          .map((type) => type.name)
          .join(',')}) should have only 1 non-strict directory`, () => {
          const nonStrictTypes = types.filter((type) => !type.strictDirectoryName);
          expect(nonStrictTypes.length, nonStrictTypes.map((type) => type.name).join(',')).lessThan(
            2
          );
        });
      }
    });
  });

  describe('strict types are all in strictDirectoryNames', () => {
    const strictTypeMap = new Map<string, string>();
    Object.values(registry.types)
      .filter((type) => type.strictDirectoryName)
      .map((type) => {
        // the type's suffix
        strictTypeMap.set(type.directoryName, type.id);
      });
    strictTypeMap.forEach((typeid, strictDirectoryName) => {
      it(`has a strictDirectoryNames entry for "${strictDirectoryName}" : "${typeid}"`, () => {
        expect(typeid).to.be.a('string');
        expect(strictDirectoryName).to.be.a('string');
        expect(registry.strictDirectoryNames[strictDirectoryName]).to.equal(typeid);
      });
    });
  });
});
