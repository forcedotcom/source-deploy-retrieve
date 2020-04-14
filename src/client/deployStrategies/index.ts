/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Connection } from '@salesforce/core';
import { BaseDeploy } from './baseDeploy';
import { BundleDeploy } from './bundleDeploy';
import { ContainerDeploy } from './containerDeploy';
import { BundleTypes } from './deployUtils';

export {
  supportedToolingTypes,
  BundleTypes,
  DeployStatusEnum,
  ToolingCreateResult,
  ToolingDeployResult,
  DeployDetailsResult,
  DeployResult,
  BundleMetadataObj
} from './deployUtils';
export {
  AURA_DEF_BUNDLE,
  CONTAINER_ASYNC_REQUEST,
  METADATA_CONTAINER
} from './constants';
export { BaseDeploy } from './baseDeploy';
export { ContainerDeploy } from './containerDeploy';
export { BundleDeploy } from './bundleDeploy';

export const getDeployStrategy = (
  type: string,
  connection: Connection
): BaseDeploy => {
  const deployStrategy = BundleTypes.includes(type)
    ? new BundleDeploy(connection)
    : new ContainerDeploy(connection);
  return deployStrategy;
};
