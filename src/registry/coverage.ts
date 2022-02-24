/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import got from 'got';
import { CoverageObject } from '../../src/registry/types';

export const getCurrentApiVersion = async (): Promise<number> => {
  return (
    JSON.parse((await got('https://mdcoverage.secure.force.com/services/apexrest/report')).body) as {
      versions: { selected: number };
    }
  ).versions.selected;
};

export const getCoverage = async (apiVersion: number): Promise<CoverageObject> =>
  JSON.parse(
    (await got(`https://na${apiVersion - 9}.test1.pc-rnd.salesforce.com/mdcoverage/api.jsp`)).body
  ) as CoverageObject;
