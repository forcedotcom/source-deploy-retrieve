/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MetadataType } from './common';

/**
 * Metadata type definitions
 */
export type TypeIndex = { [typeId: string]: MetadataType };
/**
 * Index mapping file suffixes to type ids.
 */
export type SuffixIndex = { [suffix: string]: string };

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
