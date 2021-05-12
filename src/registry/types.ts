/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * A database of metadata types and configuration to define component behavior
 * when performing library operations.
 */
export interface MetadataRegistry {
  types: TypeIndex;
  suffixes?: SuffixIndex;
  strictDirectoryNames: {
    [directoryName: string]: string;
  };
  childTypes: {
    [childTypeId: string]: string;
  };
  apiVersion: string;
}

/**
 * Metadata type definition in the registry.
 */
export interface MetadataType {
  /**
   * Unique identifier of the metadata type. Usually the API name lowercased.
   */
  id: string;
  /**
   * API name of the metadata type.
   */
  name: string;
  /**
   * Name of the directory where components are located in a package.
   */
  directoryName?: string;
  /**
   * Whether or not components are stored in folders.
   *
   * __Examples:__ Reports, Dashboards, Documents, EmailTemplates
   *
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
   * If the parent name should be ignored when constructing the type's fullName
   */
  ignoreParentName?: boolean;
  /**
   * The xml attribute used as the unique identifier when parsing the xml
   */
  uniqueIdElement?: string;
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
    recomposition?: string;
  };
}

/**
 * Mapping of metadata type ids -> Metadata type definitions.
 */
interface TypeIndex {
  [typeId: string]: MetadataType;
}

/**
 * Mapping of metadata type file suffixes -> type ids.
 */
interface SuffixIndex {
  [suffix: string]: string;
}

/**
 * Mapping of metadata type directory names -> type ids.
 */
interface DirectoryIndex {
  [directoryName: string]: string;
}

/**
 * Strategy names for handling component decomposition.
 */
export const enum DecompositionStrategy {
  /**
   * Elements of child types are decomposed to the same folder the parent object is in.
   */
  TopLevel = 'topLevel',
  /**
   * Elements of child types are decomposed into folders of their respective types.
   */
  FolderPerType = 'folderPerType',
}

/**
 * Strategy names for handling component recomposition.
 */
export const enum RecompositionStrategy {
  /**
   * The parent object should start as an empty object when recomposing the child types
   */
  StartEmpty = 'startEmpty',
}

/**
 * Strategy names for the type of transformation to use for metadata types.
 */
export const enum TransformerStrategy {
  Standard = 'standard',
  Decomposed = 'decomposed',
  StaticResource = 'staticResource',
  NonDecomposed = 'nonDecomposed',
}
