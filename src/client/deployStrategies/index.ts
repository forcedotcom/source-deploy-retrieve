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
import { AuraDeploy } from './auraDeploy';
import { AURA_DEF_BUNDLE } from './constants';

export {
  AURA_TYPES,
  CONTAINER_ASYNC_REQUEST,
  METADATA_CONTAINER
} from './constants';
export { ContainerDeploy } from './containerDeploy';
export { BundleDeploy } from './bundleDeploy';
export { AuraDeploy } from './auraDeploy';

export const getDeployStrategy = (
  type: string,
  connection: Connection
): BaseDeploy => {
  const deployStrategy =
    type === AURA_DEF_BUNDLE
      ? new AuraDeploy(connection)
      : new ContainerDeploy(connection);
  return deployStrategy;
};
