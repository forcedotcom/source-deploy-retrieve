/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TypeIndex, SuffixIndex } from './registry';

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
   * Type definitions for child types, if the type has any.
   *
   * __Examples:__ `CustomField` and `CompactLayout` on `CustomObject`
   */
  children?: {
    types: TypeIndex;
    suffixes: SuffixIndex;
  };
};

export interface MetadataComponent {
  /**
   * Fully qualified name of the component.
   */
  fullName: string;
  type: MetadataType;
}

/**
 * Representation of a MetadataComponent in a file tree.
 */
export interface SourceComponent extends MetadataComponent {
  /**
   * Path to the root metadata xml file.
   */
  xml: SourcePath;
  /**
   * Path to the component's content.
   */
  content?: SourcePath;
  /**
   * Traverse a component's content if it is a directory, otherwise only the `content`
   * property is resolved.
   *
   * @returns {IterableIterator<SourcePath>} Iterator for traversing content
   */
  walkContent(): SourcePath[];
  /**
   * Traverse a component's children if it has any.
   *
   * @returns {IterableIterator<SourceComponent>} Iterator for traversing child components
   */
  getChildren(): SourceComponent[];
}
