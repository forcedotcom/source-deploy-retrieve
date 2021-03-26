/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { OptionalTreeRegistryOptions } from '../common';
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

export interface FromSourceOptions extends OptionalTreeRegistryOptions {
  /**
   * File or directory paths to resolve components against
   */
  fsPaths: string[];
  /**
   * Only resolve components contained in the given set
   */
  inclusiveFilter?: ComponentSet;
}

export interface FromManifestOptions extends OptionalTreeRegistryOptions {
  resolve?: Iterable<string>;
  literalWildcard?: boolean;
}
