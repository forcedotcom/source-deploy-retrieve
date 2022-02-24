/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { CoverageObjectType } from '../../src/registry/types';
import { getMissingTypes } from '../../test/utils/getMissingTypes';
import { registry } from '../../src';
import { getCoverage, getCurrentApiVersion } from '../../src/registry/coverage';

describe('registry completeness', () => {
  let missingTypes: Array<[string, CoverageObjectType]>;

  before(async function () {
    this.timeout(20000);
    missingTypes = getMissingTypes(await getCoverage(await getCurrentApiVersion()), registry);
  });

  it('every type from metadata coverage is in the SDR registry', () => {
    expect(missingTypes.map(([key]) => key).sort()).to.deep.equal([]);
  });
}).timeout(10000);
