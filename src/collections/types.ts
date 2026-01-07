/*
 * Copyright 2026, Salesforce, Inc.
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
