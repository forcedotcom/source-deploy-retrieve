/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { BaseDeploy } from './baseDeploy';
import { BundleTypes } from './deployUtil';
import { BundleDeploy } from './bundleDeploy';
import { ApexDeploy } from './apexDeploy';
import { Connection } from '@salesforce/core';

export {
  DeployResult,
  DeployStatusEnum,
  FilePathOpts,
  supportedToolingTypes,
  ToolingCreateResult,
  ToolingDeployResult,
  BundleTypes
} from './deployUtil';
export { Deploy } from '../toolingDeploy';
export { ApexDeploy } from './apexDeploy';
export { BundleDeploy } from './bundleDeploy';

export const getDeployStrategy = (
  type: string,
  connection: Connection,
  apiVersion?: string
): BaseDeploy => {
  const deployStrategy = BundleTypes.includes(type)
    ? new BundleDeploy(connection, apiVersion)
    : new ApexDeploy(connection, apiVersion);
  return deployStrategy;
};
