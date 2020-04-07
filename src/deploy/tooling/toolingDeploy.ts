/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import { nls } from '../../i18n';
import { RegistryAccess } from '../../metadata-registry/index';
import {
  supportedToolingTypes,
  ToolingDeployResult,
  getDeployStrategy
} from './deployStrategies';

export class Deploy {
  public metadataType: string;
  public connection: Connection;
  private apiVersion: string;
  private registryAccess: RegistryAccess;

  public constructor(
    connection: Connection,
    apiVersion?: string,
    registryAccess?: RegistryAccess
  ) {
    this.connection = connection;
    this.apiVersion = apiVersion;
    if (registryAccess) {
      this.registryAccess = registryAccess;
    } else {
      this.registryAccess = new RegistryAccess();
    }
  }

  public async deploy(filePath: string): Promise<ToolingDeployResult> {
    const component = this.registryAccess.getComponentsFromPath(filePath)[0];
    this.metadataType = component.type.name;

    if (supportedToolingTypes.get(this.metadataType) === undefined) {
      const deployFailed = new Error();
      deployFailed.message = nls.localize(
        'beta_tapi_membertype_unsupported_error',
        this.metadataType
      );
      deployFailed.name = 'MetadataTypeUnsupported';
      throw deployFailed;
    }

    const deployStrategy = getDeployStrategy(
      this.metadataType,
      this.connection,
      this.apiVersion
    );
    return deployStrategy.deploy(component);
  }
}
