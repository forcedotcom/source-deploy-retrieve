/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Connection } from '@salesforce/core';
import { BaseDeploy } from './baseDeploy';
import { ContainerDeploy } from './containerDeploy';

export { CONTAINER_ASYNC_REQUEST, METADATA_CONTAINER } from './constants';
export { ContainerDeploy } from './containerDeploy';

export const getDeployStrategy = (
  type: string,
  connection: Connection
): BaseDeploy => {
  const deployStrategy = new ContainerDeploy(connection);
  return deployStrategy;
};
