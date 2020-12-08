/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { MetadataComponent } from '../common';
import { RegistryAccess, TreeContainer } from '../metadata-registry';
import { ComponentSet } from './componentSet';

export interface PackageTypeMembers {
  name: string;
  members: string[];
}

export interface PackageManifestObject {
  Package: {
    types: PackageTypeMembers[];
    version: string;
  };
}

export interface FromSourceOptions {
  registry?: RegistryAccess;
  tree?: TreeContainer;
}

export interface FromManifestOptions {
  literalWildcard?: boolean;
  registry?: RegistryAccess;
  resolve?: Iterable<string>;
  resolveChildrenWithParent?: boolean;
  tree?: TreeContainer;
}

export interface ResolveOptions {
  filter?: MetadataComponent[] | ComponentSet;
  resolveChildrenWithParent?: boolean;
  tree?: TreeContainer;
}
