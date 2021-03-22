/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { OptionalTreeRegistryOptions, XML_NS_KEY } from '../common';
import { ComponentSet } from './componentSet';

export interface PackageTypeMembers {
  name: string;
  members: string[];
}

export interface PackageManifestObject {
  Package: {
    types: PackageTypeMembers[];
    version: string;
    fullName: string;
    [XML_NS_KEY]?: string;
  };
}

export interface FromSourceOptions extends OptionalTreeRegistryOptions {
  /**
   * File paths or directory paths to resolve components against
   */
  fsPaths: string[];
  /**
   * Only resolve components contained in the given set
   */
  include?: ComponentSet;
}

export interface FromManifestOptions extends OptionalTreeRegistryOptions {
  /**
   * Path to the manifest file in XML format
   */
  manifestPath: string;
  /**
   * Paths to resolve source-backed components. The manifest file is used to
   * indicate which components to include.
   */
  resolveSourcePaths?: string[];
  /**
   * By default, wildcard members encoutered in the manifest are added to the set
   * e.g. `{ fullName: '*', type: 'ApexClass' }`. If `resolveSourcePaths` is set,
   * wildcard components are not added to the final set, but are used in the filter
   * when resolving source-backed components to match all components with the wildcard
   * type.
   *
   * Use this flag to always add wildcard components to the set, regardless of the other
   * conditions.
   */
  forceAddWildcards?: boolean;
}
