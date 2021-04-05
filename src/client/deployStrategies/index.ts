/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Connection } from '@salesforce/core';
import { BaseDeploy } from './baseDeploy';
import { ContainerDeploy } from './containerDeploy';
import { AuraDeploy } from './auraDeploy';
import { LwcDeploy } from './lwcDeploy';
import { registry } from '../../registry';

export { ContainerDeploy } from './containerDeploy';
export { AuraDeploy } from './auraDeploy';
export { LwcDeploy } from './lwcDeploy';

export const getDeployStrategy = (type: string, connection: Connection): BaseDeploy => {
  switch (type) {
    case registry.types.auradefinitionbundle.name:
      return new AuraDeploy(connection);
    case registry.types.lightningcomponentbundle.name:
      return new LwcDeploy(connection);
    default:
      return new ContainerDeploy(connection);
  }
};
