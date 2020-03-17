/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Properties of a metadata type.
 */
export type MetadataType = {
  name: string;
  /**
   * Name of the directory where components are located in a package
   */
  directoryName: string;
  /**
   * Whether or not components are stored in folders.
   *
   * __Examples:__ Reports, Dashboards, Documents, EmailTemplates
   */
  inFolder: boolean;
  /**
   * File suffix
   *
   * Some types may not have one, such as those made up of varying file extensions.
   *
   * __Examples:__ LightningComponentBundles, Documents, StaticResources
   */
  suffix?: string;
  /**
   * Names of the subtypes if the type has any.
   */
  childXmlNames?: string[];
};

/**
 * Source information about a single metadata component.
 */
export type MetadataComponent = {
  fullName: string;
  type: MetadataType;
  /**
   * Path to the -meta.xml file.
   */
  metaXml: SourcePath;
  /**
   * Paths to additional source files, if any.
   */
  sources: SourcePath[];
};

/**
 * File system path to a source file of a metadata component.
 */
export type SourcePath = string;

export type MetadataRegistry = {
  types: {
    [metadataId: string]: MetadataType;
  };
  /**
   * Index mapping file suffixes to type ids.
   */
  suffixes: {
    [suffix: string]: string;
  };
  /**
   * Index mapping directoryNames to type ids for types with mixed content.
   */
  mixedContent: {
    [directoryName: string]: string;
  };
  /**
   * SourceAdapter mappings for types that need an explicit definition.
   */
  adapters: {
    [adapterId: string]: string;
  };
};

export type MetadataXml = {
  fullName: string;
  suffix: string;
};

/**
 * Infers the source format structure of a metadata component when given a file path.
 */
export interface SourceAdapter {
  getComponent(fsPath: SourcePath): MetadataComponent;
}
