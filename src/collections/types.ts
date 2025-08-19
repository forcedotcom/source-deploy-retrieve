/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Connection } from '@salesforce/core';
import { OptionalTreeRegistryOptions } from '../common/types';
import { XML_NS_KEY } from '../common/constants';
import { FileProperties } from '../client/types';
import { ComponentSet } from './componentSet';

export type PackageTypeMembers = {
  name: string;
  members: string[];
};

export type PackageManifestObject = {
  Package: {
    types: PackageTypeMembers[];
    version: string;
    fullName?: string;
    [XML_NS_KEY]?: string;
  };
};

// TODO NEXT MAJOR: use a string union type
export enum DestructiveChangesType {
  POST = 'post',
  PRE = 'pre',
}

export type FromSourceOptions = {
  /**
   * File paths or directory paths to resolve components against
   */
  fsPaths: string[];
  /**
   * Only resolve components contained in the given set
   */
  include?: ComponentSet;
  /**
   * File paths or directory paths of deleted components, i.e., destructive changes.
   */
  fsDeletePaths?: string[];
  /**
   * Whether to use filesystem-based ForceIgnore during component resolution.
   */
  useFsForceIgnore?: boolean;
} & OptionalTreeRegistryOptions;

export type FromManifestOptions = {
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
   * By default, wildcard members encountered in the manifest are added to the set
   * e.g. `{ fullName: '*', type: 'ApexClass' }`. If `resolveSourcePaths` is set,
   * wildcard components are not added to the final set, but are used in the filter
   * when resolving source-backed components to match all components with the wildcard
   * type.
   *
   * Use this flag to always add wildcard components to the set, regardless of the other
   * conditions.
   */
  forceAddWildcards?: boolean;

  /**
   * path to a `destructiveChangesPre.xml` file in XML format
   */
  destructivePre?: string;
  /**
   * path to a `destructiveChangesPost.xml` file in XML format
   */
  destructivePost?: string;
} & OptionalTreeRegistryOptions;

export type FromConnectionOptions = {
  /**
   * username or connection to an org
   */
  usernameOrConnection: string | Connection;
  /**
   * the metadata API version to use
   */
  apiVersion?: string;
  /**
   * filter the result components to e.g. remove managed components
   */
  componentFilter?: (component: Partial<FileProperties>) => boolean;
  /**
   * array of metadata type names to use for `connection.metadata.list()`
   */
  metadataTypes?: string[];
} & OptionalTreeRegistryOptions;
