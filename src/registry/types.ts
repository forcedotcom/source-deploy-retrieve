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
  suffixes: SuffixIndex;
  strictDirectoryNames: {
    [directoryName: string]: string;
  };
  childTypes: {
    [childTypeId: string]: string;
  };
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
  directoryName: string;
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
   * MetaFile suffix
   *
   * An override to the default "-meta.xml" suffix.
   *
   * __Examples:__ "_meta.json" for DigitalExperience.
   */
  metaFileSuffix?: string;
  /**
   * Whether or not components are required to reside in a folder named after the type's directoryName.
   */
  strictDirectoryName?: boolean;
  /**
   * Whether or not to ignore the fullName that's parsed from the file path. If true, the metadata type's
   * name will be used instead. For example, CustomLabels instead of MyLabels.
   */
  ignoreParsedFullName?: boolean;
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
   * The XML element name for the type in the xml file used for constructing child components.
   */
  xmlElementName?: string;
  /**
   * When converting deploying source, this will update the suffix in the output or temporary directory (metadata format)
   * Use this, along with additional suffix keys in the registry, to support incorrect suffixes from existing code
   */
  legacySuffix?: string;
  /**
   * The xml attribute used as the unique identifier when parsing the xml
   */
  uniqueIdElement?: string;
  /**
   * Whether the component is supported by the Metadata API and therefore should be included within a manifest.
   */
  isAddressable?: boolean;
  /**
   * Whether the component requires the parent to be present when deploying/retrieving
   */
  unaddressableWithoutParent?: boolean;

  /**
   * Whether or not components of the same type can be can be specified with the wildcard character, and by name in a manifest
   *
   ```
   <members>*</members>
   <members>Account</members>
   <name>CustomObject</name>
   ```
   */
  supportsWildcardAndName?: boolean;

  /**
   * Whether the component can be partially deleted, such as metadata types that are made up of multiple files.
   *
   * __Examples:__ `LightningComponentBundle`, `ExperienceBundle`, `StaticResource`, and `DigitalExperienceBundle`
   */
  supportsPartialDelete?: boolean;

  /**
   * Whenever this type is requested, return the aliasFor type instead
   */
  aliasFor?: string;
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
    adapter:
      | 'sourceAdapter'
      | 'mixedContent'
      | 'matchingContentFile'
      | 'decomposed'
      | 'nonDecomposed'
      | 'digitalExperience'
      | 'bundle';
    transformer?: 'decomposed' | 'staticResource' | 'nonDecomposed' | 'standard' | 'merged';
    transformerConfig?: MergedTransformerConfig;
    decomposition?: 'topLevel' | 'folderPerType';
    recomposition?: 'startEmpty';
  };
}

interface MergedTransformerConfig {
  rootNode: string;
  defaultHandling: MergedTransformerConfigHandler;
  nodeHandling: {
    [node: string]: MergedTransformerConfigHandler;
  };
}

interface MergedTransformerConfigHandler {
  strategy: 'replace' | 'merge';
  mappingKey?: string;
  deleteOnEmpty?: boolean;
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
  Merged = 'merged',
}

export const enum MergeStrategy {
  Replace = 'replace',
  Merge = 'merge',
}

interface Channel {
  exposed: boolean;
}
/**
 * Subset of an item from the Metadata Coverage Report
 */
export interface CoverageObjectType {
  orgShapes: {
    developer: {
      features?: string[];
      settings?: Record<string, Record<string, unknown>>;
      missingSettings?: string[];
    };
  };
  channels: {
    metadataApi: Channel;
    sourceTracking: Channel;
    toolingApi: Channel;
  };
}

/**
 * The structure returned by the metadata coverage report
 */
export interface CoverageObject {
  types: {
    [key: string]: CoverageObjectType;
  };
  // only exists on the test1 instances flavor of coverage report
  apiVersion: number;
  release: string;
}
