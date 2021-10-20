/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import got from 'got';
import { expect } from 'chai';
import { CoverageObject, CoverageObjectType } from '../../src/registry/types';
import { getMissingTypes } from '../utils/getMissingTypes';
import { frozenRegistry } from '../../src';

describe('registry completeness', () => {
  let metadataCoverage: CoverageObject;
  let missingTypes: Array<[string, CoverageObjectType]>;

  before(async function () {
    this.timeout(10000);
    metadataCoverage = JSON.parse(
      (await got('https://mdcoverage.secure.force.com/services/apexrest/report')).body
    ) as CoverageObject;

    missingTypes = getMissingTypes(metadataCoverage, frozenRegistry);
  });

  it('every type from metadata coverage is in the SDR registry', () => {
    expect(missingTypes.map(([key]) => key).sort()).to.deep.equal([]);
  });
}).timeout(10000);
