/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ComponentLike } from '../common';
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

interface ComponentSetOptions {
  registry?: RegistryAccess;
}

export interface FromSourceOptions extends ComponentSetOptions {
  filter?: Iterable<ComponentLike> | ComponentSet;
  tree?: TreeContainer;
}

export interface FromManifestOptions extends FromSourceOptions {
  resolve?: Iterable<string>;
  literalWildcard?: boolean;
}

export type ResolveOptions = Omit<FromSourceOptions, 'registry'>;
