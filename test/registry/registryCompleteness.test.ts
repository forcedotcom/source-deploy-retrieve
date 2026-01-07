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
import { CoverageObjectType } from '../../src/registry/types';
import { getMissingTypes } from '../../test/utils/getMissingTypes';
import { registry } from '../../src';
import { getCoverage, getCurrentApiVersion } from '../../src/registry/coverage';

describe('registry completeness', () => {
  let missingTypes: Array<[string, CoverageObjectType]>;

  before(async () => {
    missingTypes = getMissingTypes(await getCoverage(await getCurrentApiVersion()), registry);
  });

  it('every type from metadata coverage is in the SDR registry', () => {
    expect(missingTypes.map(([key]) => key).sort()).to.deep.equal([]);
  });
});
