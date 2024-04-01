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
import { isString } from '@salesforce/ts-types';
import { SfError } from '@salesforce/core';
import { CoverageObject } from '../../src/registry/types';

const getProxiedOptions = (url: string): OptionsOfTextResponseBody => ({
  timeout: {
    request: 10_000,
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

let apiVer: number;

export const getCurrentApiVersion = async (): Promise<number> => {
  if (apiVer === undefined) {
    try {
      const apiVersionsUrl = 'https://appexchange.salesforce.com/services/data';
      const lastVersionEntry = (await got(getProxiedOptions(apiVersionsUrl)).json<ApiVersion[]>()).at(-1) as ApiVersion;
      apiVer = +lastVersionEntry.version;
    } catch (e: unknown) {
      const err = e instanceof Error ? e : SfError.wrap(isString(e) ? e : 'unknown');
      const eMsg = 'Unable to get a current API version from the appexchange org';
      const eActions = ['Provide an API version explicitly', 'Set an API version in the project configuration'];
      throw new SfError(eMsg, 'ApiVersionRetrievalError', eActions, err);
    }
  }
  return apiVer;
};

export const getCoverage = async (apiVersion: number): Promise<CoverageObject> => {
  const versionSources = [
    { cell: 'sdb3', test: 1 },
    { cell: 'ora15', test: 1 },
    { cell: 'sdb4s', test: 1 },
    { cell: 'sdb6', test: 1 },
    { cell: 'ora14', test: 1 },
    { cell: 'sdb10s', test: 1 },
    { cell: 'sdb27', test: 1 },
    { cell: 'ora16', test: 2 },
    { cell: 'sdb14', test: 2 },
    { cell: 'sdb15', test: 2 },
    { cell: 'sdb17s', test: 2 },
    { cell: 'sdb18s', test: 2 },
  ];
  const urls = versionSources.map(
    ({ cell, test }) => `https://${cell}.test${test}.pc-rnd.pc-aws.salesforce.com/mdcoverage/api.jsp`
  );

  const results = await Promise.allSettled(
    urls.map(getProxiedOptions).map(async (proxy) => got(proxy).json<CoverageObject>())
  );
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value?.apiVersion === apiVersion) {
      return result.value;
    }
  }

  console.log(`WARNING: Could not find coverage for api version ${apiVersion}.  Urls attempted:`);
  urls.forEach((url) => console.log(url));
  return {
    apiVersion,
    release: '',
    types: {},
  };
};
