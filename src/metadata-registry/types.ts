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
 * File system path to a source file of a metadata component.
 */
export type SourcePath = string;

/**
 * Describes the shape of the registry data.
 */
export type MetadataRegistry = {
  /**
   * Metadata type definitions
   */
  types: {
    [typeId: string]: MetadataType;
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
    [typeId: string]: string;
  };
  /**
   * API Version
   */
  apiVersion: string;
};

export type MetadataXml = {
  fullName: string;
  suffix: string;
};
