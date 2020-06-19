/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { MetadataRegistry, MetadataType, SourceAdapter, TreeContainer } from '../../types';
import { BundleSourceAdapter } from './bundleSourceAdapter';
import { DecomposedSourceAdapter } from './decomposedSourceAdapter';
import { MatchingContentSourceAdapter } from './matchingContentSourceAdapter';
import { MixedContentSourceAdapter } from './mixedContentSourceAdapter';
import { DefaultSourceAdapter } from './defaultSourceAdapter';
import { RegistryError } from '../../errors';
import { ForceIgnore } from '../forceIgnore';
import { registryData, NodeFSTreeContainer } from '..';

enum AdapterId {
  Bundle = 'bundle',
  Decomposed = 'decomposed',
  MatchingContentFile = 'matchingContentFile',
  MixedContent = 'mixedContent'
}

export class SourceAdapterFactory {
  private registry: MetadataRegistry;
  private tree: TreeContainer;

  constructor(
    registry: MetadataRegistry = registryData,
    tree: TreeContainer = new NodeFSTreeContainer()
  ) {
    this.registry = registry;
    this.tree = tree;
  }

  public getAdapter(type: MetadataType, forceIgnore = new ForceIgnore()): SourceAdapter {
    const adapterId = this.registry.adapters[type.id] as AdapterId;
    switch (adapterId) {
      case AdapterId.Bundle:
        return new BundleSourceAdapter(type, this.registry, forceIgnore, this.tree);
      case AdapterId.Decomposed:
        return new DecomposedSourceAdapter(type, this.registry, forceIgnore, this.tree);
      case AdapterId.MatchingContentFile:
        return new MatchingContentSourceAdapter(type, this.registry, forceIgnore, this.tree);
      case AdapterId.MixedContent:
        return new MixedContentSourceAdapter(type, this.registry, forceIgnore, this.tree);
      case undefined:
        return new DefaultSourceAdapter(type, this.registry, forceIgnore, this.tree);
      default:
        throw new RegistryError('error_missing_adapter', [type.name, adapterId]);
    }
  }
}
