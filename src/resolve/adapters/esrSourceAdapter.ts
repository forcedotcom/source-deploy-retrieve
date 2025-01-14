/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { MetadataType, RegistryAccess } from '../../registry';
import { ForceIgnore } from '../forceIgnore';
import { NodeFSTreeContainer } from '../treeContainers';
import { MixedContentSourceAdapter } from './mixedContentSourceAdapter';

export class EsrSourceAdapter extends MixedContentSourceAdapter {
  public constructor(
    type: MetadataType,
    registry = new RegistryAccess(),
    forceIgnore = new ForceIgnore(),
    tree = new NodeFSTreeContainer()
  ) {
    super(type, registry, forceIgnore, tree);
    this.metadataWithContent = false;
  }
}
