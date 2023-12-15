/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable no-console */

import { OptionsOfTextResponseBody } from 'got';
import got from 'got';
import { ProxyAgent } from 'proxy-agent';
import { CoverageObject } from '../../src/registry/types';

const getProxiedOptions = (url: string): OptionsOfTextResponseBody => ({
  timeout: {
    request: 10000,
  },
  agent: {
    https: new ProxyAgent(),
  },
  url,
});

type ApiVersion = {
  label: string;
  url: string;
  version: string;
};

export const getCurrentApiVersion = async (): Promise<number> => {
  const apiVersionsUrl = 'https://dx-extended-coverage.my.salesforce-sites.com/services/data';
  const lastVersionEntry = (await got(getProxiedOptions(apiVersionsUrl)).json<ApiVersion[]>()).pop() as ApiVersion;
  return +lastVersionEntry.version;
};

export const getCoverage = async (apiVersion: number): Promise<CoverageObject> => {
  const results = await Promise.allSettled(
    // one of these will match the current version, but they differ during the release cycle
    // references: https://confluence.internal.salesforce.com/pages/viewpage.action?pageId=194189303
    [
      { cell: 'sdb3', test: 1 },
      { cell: 'ora3', test: 1 },
      { cell: 'sdb4s', test: 1 },
      { cell: 'sdb6', test: 1 },
      { cell: 'ora6', test: 1 },
      { cell: 'sdb10s', test: 1 },
      { cell: 'ora7', test: 2 },
      { cell: 'ora8', test: 2 },
      { cell: 'sdb14', test: 2 },
      { cell: 'sdb15', test: 2 },
      { cell: 'sdb17s', test: 2 },
      { cell: 'sdb18s', test: 2 },
    ].map(async ({ cell, test }) =>
      got(
        getProxiedOptions(`https://${cell}.test${test}.pc-rnd.pc-aws.salesforce.com/mdcoverage/api.jsp`)
      ).json<CoverageObject>()
    )
  );
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value?.apiVersion === apiVersion) {
      return result.value;
    }
  }

  console.log(`WARNING: Could not find coverage for api version ${apiVersion}`);

  return {
    apiVersion,
    release: '',
    types: {},
  };
};
