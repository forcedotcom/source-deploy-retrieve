/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  TypeIndex,
  SuffixIndex,
  DirectoryIndex,
  RegistryAccess,
  TreeContainer,
} from '../metadata-registry';

/**
 * File system path to a source file of a metadata component.
 */
export type SourcePath = string;

export type MetadataType = {
  id: string;
  name: string;
  /**
   * Name of the directory where components are located in a package
   */
  directoryName?: string;
  /**
   * Whether or not components are stored in folders.
   *
   * __Examples:__ Reports, Dashboards, Documents, EmailTemplates
   * @deprecated use `folderType` to get the related folder type, if one exists
   */
  inFolder?: boolean;
  /**
   * File suffix
   *
   * Some types may not have one, such as those made up of varying file extensions.
   *
   * __Examples:__ LightningComponentBundles, Documents, StaticResources
   */
  suffix?: string;
  /**
   * Whether or not components are required to reside in a folder named after the type's directoryName.
   */
  strictDirectoryName?: boolean;
  /**
   * If the type is a folder type (container for components), the id of the type it is a container for.
   */
  folderContentType?: string;
  /**
   * If the type is contained in folders, the id of the type that contains it.
   */
  folderType?: string;
  /**
   * Type definitions for child types, if the type has any.
   *
   * __Examples:__ `CustomField` and `CompactLayout` on `CustomObject`
   */
  children?: {
    types: TypeIndex;
    suffixes: SuffixIndex;
    directories?: DirectoryIndex;
  };
  /**
   * Configuration for resolving and converting components of the type.
   */
  strategies?: {
    adapter: string;
    transformer?: string;
    decomposition?: string;
  };
};

export interface MetadataComponent {
  /**
   * Fully qualified name of the component.
   */
  fullName: string;
  type: MetadataType;
  parent?: MetadataComponent;
}

export interface MetadataMember {
  fullName: string;
  type: string;
}

export type ComponentLike = MetadataComponent | MetadataMember;

export interface TreeOptions {
  tree: TreeContainer;
}

export interface RegistryOptions {
  registry: RegistryAccess;
}

export interface OptionalTreeRegistryOptions
  extends Partial<TreeOptions>,
    Partial<RegistryOptions> {}
