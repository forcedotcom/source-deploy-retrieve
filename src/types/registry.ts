/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MetadataType, SourcePath, SourceComponent } from './common';

/**
 * Metadata type definitions
 */
export type TypeIndex = { [typeId: string]: MetadataType };
/**
 * Mapping of metadata suffixes -> type ids.
 */
export type SuffixIndex = { [suffix: string]: string };

export type Strategy = {
  adapter: string;
  transformer?: string;
};

/**
 * Describes the shape of the registry data.
 */
export type MetadataRegistry = {
  types: TypeIndex;
  suffixes?: SuffixIndex;
  /**
   * Index mapping directoryNames to type ids for types with mixed content.
   */
  mixedContent: {
    [directoryName: string]: string;
  };
  /**
   * SourceAdapter mappings for types that need an explicit definition.
   */
  strategies: {
    [typeId: string]: Strategy;
  };
  /**
   * API Version
   */
  apiVersion: string;
};

/**
 * Properties of a metadata xml's file name
 */
export type MetadataXml = {
  fullName: string;
  suffix: string;
  path: SourcePath;
};

export type VirtualDirectory = {
  dirPath: SourcePath;
  children: string[];
};

/**
 * Infers the source format structure of a metadata component when given a file path.
 */
export interface SourceAdapter {
  /**
   * Create a metadata component object from a file path.
   *
   * @param fsPath Path to resolve
   */
  getComponent(fsPath: SourcePath): SourceComponent;
}

/**
 * A tree abstraction for the registry to traverse when inferring components
 */
export interface TreeContainer {
  isDirectory(path: SourcePath): boolean;
  exists(path: SourcePath): boolean;
  readDirectory(path: SourcePath): string[];
  find(fileType: 'content' | 'metadata', fullName: string, dir: SourcePath): SourcePath | undefined;
}
