/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { MetadataRegistry } from '../types';

// we have to import all presets explicitly for VSCE's esbuild bundling process
// other read methods might make esbuild fail to bundle the json file
import * as decomposeCustomLabelsBeta from './decomposeCustomLabelsBeta.json';
import * as decomposeCustomLabelsBeta2 from './decomposeCustomLabelsBeta2.json';
import * as decomposePermissionSetBeta from './decomposePermissionSetBeta.json';
import * as decomposePermissionSetBeta2 from './decomposePermissionSetBeta2.json';
import * as decomposeSharingRulesBeta from './decomposeSharingRulesBeta.json';
import * as decomposeWorkflowBeta from './decomposeWorkflowBeta.json';
import * as decomposeExternalServiceRegistrationBeta from './decomposeExternalServiceRegistrationBeta.json';

export const presetMap = new Map<string, MetadataRegistry>([
  ['decomposeCustomLabelsBeta2', decomposeCustomLabelsBeta2 as MetadataRegistry],
  ['decomposeCustomLabelsBeta', decomposeCustomLabelsBeta as MetadataRegistry],
  ['decomposePermissionSetBeta', decomposePermissionSetBeta as MetadataRegistry],
  ['decomposePermissionSetBeta2', decomposePermissionSetBeta2 as MetadataRegistry],
  ['decomposeSharingRulesBeta', decomposeSharingRulesBeta as MetadataRegistry],
  ['decomposeWorkflowBeta', decomposeWorkflowBeta as MetadataRegistry],
  ['decomposeExternalServiceRegistrationBeta', decomposeExternalServiceRegistrationBeta as MetadataRegistry],
]);
