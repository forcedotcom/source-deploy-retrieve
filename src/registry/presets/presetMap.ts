/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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
