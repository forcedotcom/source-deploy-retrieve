/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export { RegistryAccess, registryData } from './metadata-registry';
export {
  DeployResult,
  DeployStatusEnum,
  FilePathOpts,
  getDeployStrategy,
  ToolingCreateResult,
  ToolingDeployResult,
  supportedToolingTypes
} from './tooling/deployStrategies';

export { ApiResult } from './types';
