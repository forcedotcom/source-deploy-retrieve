/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { supportedToolingTypes, getDeployStrategy } from '../index';
import { BaseApi, ApiResult } from '../types';
import { nls } from '../i18n';

export class ToolingApi extends BaseApi {
  public async deploy(filePath: string): Promise<ApiResult> {
    const component = this.registryAccess.getComponentsFromPath(filePath)[0];
    const metadataType = component.type.name;

    if (supportedToolingTypes.get(metadataType) === undefined) {
      const deployFailed = new Error();
      deployFailed.message = nls.localize(
        'beta_tapi_membertype_unsupported_error',
        metadataType
      );
      deployFailed.name = 'MetadataTypeUnsupported';
      throw deployFailed;
    }

    const deployStrategy = getDeployStrategy(
      metadataType,
      this.connection,
      this.apiVersion
    );
    return deployStrategy.deploy(component);
  }
}
