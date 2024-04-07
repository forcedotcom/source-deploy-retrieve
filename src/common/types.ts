/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RegistryAccess } from '../registry/registryAccess';
import { TreeContainer } from '../resolve/treeContainers';

/**
 * File system path to a source file of a metadata component.
 */
export type SourcePath = string;

export type TreeOptions = {
  tree: TreeContainer;
}

export type RegistryOptions = {
  registry: RegistryAccess;
}

export type OptionalTreeRegistryOptions = {} & Partial<TreeOptions> & Partial<RegistryOptions>
