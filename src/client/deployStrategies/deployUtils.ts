/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export const supportedToolingTypes = new Map([
  ['ApexClass', 'ApexClassMember'],
  ['ApexTrigger', 'ApexTriggerMember'],
  ['ApexPage', 'ApexPageMember'],
  ['ApexComponent', 'ApexComponentMember'],
  ['AuraDefinitionBundle', 'AuraDefinition'],
  ['LightningComponentBundle', 'LightningComponentResource']
]);

export const BundleTypes = ['LightningComponentBundle', 'AuraDefinitionBundle'];
export interface ToolingCreateResult {
  id: string;
  success: boolean;
  errors: string[];
  name: string;
  message: string;
}
export interface BundleMetadataObj {
  FilePath: string;
  DefType?: string;
  Source: string;
  Format: string;
  Id?: string;
}
