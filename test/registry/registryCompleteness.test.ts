/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import got from 'got';
import { expect } from 'chai';
import { registry as defaultRegistry } from '../../src/registry/registry';
import { MetadataRegistry } from '../../src';
import { CoverageObjectType, CoverageObject } from '../../src/registry/types';
import { hasUnsupportedFeatures, metadataTypes } from '../../src/registry/nonSupportedTypes';

describe
  .only('registry completeness', () => {
    const registry = defaultRegistry as MetadataRegistry;
    let metadataCoverage: CoverageObject;
    let missingTypes: [string, CoverageObjectType][];

    before(async function () {
      this.timeout(10000);
      metadataCoverage = JSON.parse(
        (await got(`https://mdcoverage.secure.force.com/services/apexrest/report`)).body
      ) as CoverageObject;

      // these could be child types in registry.json but still in the mdapi coverage report
      const metadataApiTypesFromCoverage = Object.entries(metadataCoverage.types).filter(
        ([key, value]) =>
          value.channels.metadataApi && // if it's not in the mdapi, we don't worry about the registry
          metadataTypes.includes(key) && // types we should ignore, see the imported file for explanations
          !key.endsWith('Settings') && // individual settings shouldn't be in the registry
          !hasUnsupportedFeatures(value) // explicitly not supported for now
      );
      expect(metadataApiTypesFromCoverage.length).to.be.greaterThan(200);

      const registryTypeNames = Object.values(registry.types).flatMap((regType) => [
        regType.name,
        ...(regType.children
          ? Object.values(regType.children.types).map((child) => child.name)
          : []),
      ]);
      missingTypes = metadataApiTypesFromCoverage.filter(
        ([key]) => !registryTypeNames.includes(key)
      );
    });

    it('every type from metadata coverage is in the SDR registry', () => {
      expect(missingTypes.map(([key]) => key).sort()).to.deep.equal([]);
    });
  })
  .timeout(10000);
