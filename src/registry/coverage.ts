/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable no-console */

import got from 'got';
import { CoverageObject } from '../../src/registry/types';

const gotOptions = {
  timeout: {
    request: 10000,
  },
};

export const getCurrentApiVersion = async (): Promise<number> =>
  (
    await got('https://mdcoverage.secure.force.com/services/apexrest/report', gotOptions).json<{
      versions: { selected: number };
    }>()
  ).versions.selected;

export const getCoverage = async (apiVersion: number): Promise<CoverageObject> => {
  const results = await Promise.allSettled(
    // one of these will match the current version, but they differ during the release cycle
    [44, 45, 46].map(
      async (na) =>
        await got(`https://na${na}.test1.pc-rnd.salesforce.com/mdcoverage/api.jsp`, gotOptions).json<CoverageObject>()
    )
  );
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value?.apiVersion === apiVersion) {
      return result.value;
    }
  }
  throw new Error(`could not find coverage for api version ${apiVersion}`);
};
