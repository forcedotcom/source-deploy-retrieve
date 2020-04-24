/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

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

export interface AuraDefinition {
  FilePath: string;
  DefType: string;
  Source: string;
  Format: string;
  Id?: string;
}
