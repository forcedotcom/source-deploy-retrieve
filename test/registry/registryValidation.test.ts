/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { MetadataRegistry } from '../../src';
import { registry as defaultRegistry } from '../../src/registry/registry';
import got from 'got';

const apiVersionMax = 52;
interface CoverageObject {
  types: {
    [key: string]: {
      scratchDefinitions: {
        professional: string;
        group: string;
        enterprise: string;
        developer: string;
      };
      channels: {
        metadataApi: boolean;
        sourceTracking: boolean;
        toolingApi: boolean;
      };
    };
  };
  versions: {
    selected: number;
    max: number;
    min: number;
  };
}

describe('Registry Validation', () => {
  const registry = defaultRegistry as MetadataRegistry;
  const typesWithChildren = Object.values(registry.types).filter((type) => type.children);

  describe('every type from metadata coverage is in the SDR registry', () => {
    before(async function () {
      this.timeout(10000);
      const metadataCoverage = JSON.parse(
        (
          await got(
            `https://mdcoverage.secure.force.com/services/apexrest/report?version=${apiVersionMax}`
          )
        ).body
      ) as CoverageObject;

      // these include child types
      const metadataApiTypes = Object.entries(metadataCoverage.types).filter(
        ([key, value]) => value.channels.metadataApi && !key.endsWith('Settings')
      );
      expect(metadataApiTypes.length).to.be.greaterThan(200);

      describe('generated type specs', () => {
        metadataApiTypes.forEach((mdType) => {
          it(`${mdType[0]}`, () => {
            const found =
              // the mdapi type could be a top-level type or a child type
              Object.values(registry.types).findIndex((regType) => regType.name === mdType[0]) >
                -1 ||
              typesWithChildren.some((type) =>
                Object.values(type.children.types).find((childType) => childType.name === mdType[0])
              );

            expect(found).to.be.true;
          });
        });
      });
    });

    it('Dummy test case, so before is executed', () => expect(true).to.be.true);
  });

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
});
