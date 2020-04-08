/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import { ToolingApi } from './tooling';
import { registryData } from './metadata-registry';

export {
  RegistryAccess,
  registryData,
  ManifestGenerator
} from './metadata-registry';
export {
  Deploy,
  DeployResult,
  DeployStatusEnum,
  FilePathOpts,
  ToolingCreateResult,
  ToolingDeployResult,
  supportedToolingTypes
} from './deploy';

export { ApiResult, RetrievePathOptions } from './types';
/**
 * Transfer SFDX source to and from a Salesforce org.
 */
export default class SourceClient {
  public readonly connection: Connection;
  public readonly apiVersion: string;
  /**
   * Perform operations using the tooling api.
   */
  public readonly tooling: ToolingApi;

  constructor(
    connection: Connection,
    apiVersion: string = registryData.apiVersion
  ) {
    this.connection = connection;
    this.apiVersion = apiVersion;
    this.tooling = new ToolingApi(connection, apiVersion);
  }
}
