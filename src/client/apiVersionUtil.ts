/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { OptionsOfTextResponseBody } from 'got';
import got from 'got';
import { ProxyAgent } from 'proxy-agent';
import { Connection, Logger, SfError, ConfigAggregator, OrgConfigProperties, SfProject, AuthInfo } from '@salesforce/core';
import { isString } from '@salesforce/ts-types';

let logger: Logger;
const getLogger = (): Logger => {
  if (!logger) {
    logger = Logger.childFromRoot('ApiVersionResolver');
  }
  return logger;
};

const getProxiedOptions = (url: string): OptionsOfTextResponseBody => ({
  timeout: {
    request: 10_000,
  },
  agent: {
    https: new ProxyAgent(),
  },
  url,
});

export type ApiVersionConfig = {
  connection?: Connection;
  username?: string;
}

export type SourceApiVersionConfig = ApiVersionConfig & {
  sfProject?: SfProject;
  sfProjectDir?: string;
}

export const resolveApiVersion = async (options: ApiVersionConfig): Promise<string> => {
  // Use config value if defined
  const apiVersionConfig = ConfigAggregator.getValue(OrgConfigProperties.ORG_API_VERSION).value;
  if (isString(apiVersionConfig)) {
    return apiVersionConfig;
  }

  // Use max api version of target org
  let connection = options.connection;
  if (!connection) {
    if (options.username) {
      connection = await Connection.create({
        authInfo: await AuthInfo.create({ username: options.username }),
      });
    }
  }
  if (connection) {
    return connection.retrieveMaxApiVersion();
  }

  // Use the current SFDC api version in production
  return `${await getCurrentSfdcApiVersion()}.0`;
}

// Resolution Order:
//   1. sourceApiVersion set in sfdx-project.json
//   2. apiVersion from ConfigAggregator (config files and Env Vars)
//   3. get the highest apiVersion from the App Exchange org
//   4. hardcoded value of "60.0" as a last resort

export const resolveSourceApiVersion = async (options: SourceApiVersionConfig): Promise<string> => {
  const project = options.sfProject ?? await SfProject.resolve(options.sfProjectDir);
  const projectConfig = await project.resolveProjectConfig();
  if (isString(projectConfig?.sourceApiVersion)) {
    return projectConfig?.sourceApiVersion;
  }
}

type ApiVersion = {
  label: string;
  url: string;
  version: string;
};

let apiVer: number;
/**
 * The current API version in Salesforce production orgs. This uses a REST
 * endpoint for the AppExchange org to get the highest supported API version.
 * 
 * @returns The current API version as a number. E.g., 63
 */
export const getCurrentSfdcApiVersion = async (): Promise<number> => {
  if (apiVer === undefined) {
    try {
      const apiVersionsUrl = 'https://appexchange.salesforce.com/services/data';
      const lastVersionEntry = (await got(getProxiedOptions(apiVersionsUrl)).json<ApiVersion[]>()).at(-1) as ApiVersion;
      apiVer = +lastVersionEntry.version;
    } catch (e: unknown) {
      const err = SfError.wrap(e);
      const eMsg = 'Unable to get a current SFDC API version from the appexchange org';
      const eActions = ['Provide an API version explicitly', 'Set an API version in the project configuration'];
      throw new SfError(eMsg, 'ApiVersionRetrievalError', eActions, err);
    }
  }
  return apiVer;
};