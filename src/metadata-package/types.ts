/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { RegistryAccess, TreeContainer } from '../metadata-registry';

export interface MetadataMember {
  fullName: string;
  type: string;
}

export interface PackageTypeMembers {
  name: string;
  members: string[];
}

export interface PackageManifestContents {
  Package: {
    types: PackageTypeMembers[];
    version: string;
  };
}

export interface MetadataPackageOptions {
  registry?: RegistryAccess;
}

export interface FromSourceOptions extends MetadataPackageOptions {
  tree?: TreeContainer;
}

export interface FromManifestOptions extends FromSourceOptions {
  resolve?: string;
}

export interface SourceComponentOptions {
  resolve?: string;
  tree?: TreeContainer;
  reinitialize?: boolean;
}
