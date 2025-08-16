/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Messages } from '@salesforce/core/messages';
import { SfError } from '@salesforce/core/sfError';
import { SourceAdapter } from '../types';
import { ForceIgnore } from '../forceIgnore';
import { RegistryAccess } from '../../registry/registryAccess';
import { MetadataType } from '../../registry/types';
import { TreeContainer } from '../treeContainers';
import { BundleSourceAdapter } from './bundleSourceAdapter';
import { DecomposedSourceAdapter } from './decomposedSourceAdapter';
import { MatchingContentSourceAdapter } from './matchingContentSourceAdapter';
import { MixedContentSourceAdapter } from './mixedContentSourceAdapter';
import { DefaultSourceAdapter } from './defaultSourceAdapter';
import { DigitalExperienceSourceAdapter } from './digitalExperienceSourceAdapter';
import { PartialDecomposedAdapter } from './partialDecomposedAdapter';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

export class SourceAdapterFactory {
  private registry: RegistryAccess;
  private tree: TreeContainer;

  public constructor(registry: RegistryAccess, tree: TreeContainer) {
    this.registry = registry;
    this.tree = tree;
  }

  public getAdapter(type: MetadataType, forceIgnore = new ForceIgnore()): SourceAdapter {
    const adapterId = type.strategies?.adapter;
    switch (adapterId) {
      case 'bundle':
        return new BundleSourceAdapter(type, this.registry, forceIgnore, this.tree);
      case 'decomposed':
        return new DecomposedSourceAdapter(type, this.registry, forceIgnore, this.tree);
      case 'matchingContentFile':
        return new MatchingContentSourceAdapter(type, this.registry, forceIgnore, this.tree);
      case 'mixedContent':
        return new MixedContentSourceAdapter(type, this.registry, forceIgnore, this.tree);
      case 'digitalExperience':
        return new DigitalExperienceSourceAdapter(type, this.registry, forceIgnore, this.tree);
      case 'partiallyDecomposed':
        return new PartialDecomposedAdapter(type, this.registry, forceIgnore, this.tree);
      case 'default':
      case undefined:
        return new DefaultSourceAdapter(type, this.registry, forceIgnore, this.tree);
      default:
        throw new SfError(messages.getMessage('error_missing_adapter', [adapterId, type.name]), 'RegistryError');
    }
  }
}
