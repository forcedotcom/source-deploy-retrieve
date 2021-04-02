/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RegistryAccess } from '../registry';
import { MetadataType } from '../registry/types';
import { TreeContainer } from '../resolution';

/**
 * File system path to a source file of a metadata component.
 */
export type SourcePath = string;

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
