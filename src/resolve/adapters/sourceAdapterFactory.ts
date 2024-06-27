/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Messages, SfError } from '@salesforce/core';
import { SourceAdapter } from '../types';
import { ForceIgnore } from '../forceIgnore';
import { RegistryAccess } from '../../registry/registryAccess';
import { MetadataType } from '../../registry/types';
import { TreeContainer } from '../treeContainers';
import { BundleSourceAdapter, getBundleComponent } from './bundleSourceAdapter';
import { DecomposedSourceAdapter } from './decomposedSourceAdapter';
import { MatchingContentSourceAdapter, getMatchingContentComponent } from './matchingContentSourceAdapter';
import { MixedContentSourceAdapter, getMixedContentComponent } from './mixedContentSourceAdapter';
import { DefaultSourceAdapter, getDefaultComponent } from './defaultSourceAdapter';
import { DigitalExperienceSourceAdapter } from './digitalExperienceSourceAdapter';
import { MaybeGetComponent } from './baseSourceAdapter';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

/** Returns a function that can resolve the given type */
export const adapterSelector = (type: MetadataType): MaybeGetComponent => {
  switch (type.strategies?.adapter) {
    case 'bundle':
      return getBundleComponent;
    // case 'decomposed':
    //   return new DecomposedSourceAdapter(type, registry, forceIgnore, tree);
    case 'matchingContentFile':
      return getMatchingContentComponent;
    case 'mixedContent':
      return getMixedContentComponent;
    // case 'digitalExperience':
    //   return getDigitalExperienceComponent
    case 'default':
    case undefined:
      return getDefaultComponent;
    default:
      throw new SfError(
        messages.getMessage('error_missing_adapter', [type.strategies?.adapter, type.name]),
        'RegistryError'
      );
  }
};

export const getAdapter =
  (registry: RegistryAccess) =>
  (tree: TreeContainer) =>
  (forceIgnore = new ForceIgnore()) =>
  (type: MetadataType): SourceAdapter => {
    switch (type.strategies?.adapter) {
      case 'bundle':
        return new BundleSourceAdapter(type, registry, forceIgnore, tree);
      case 'decomposed':
        return new DecomposedSourceAdapter(type, registry, forceIgnore, tree);
      case 'matchingContentFile':
        return new MatchingContentSourceAdapter(type, registry, forceIgnore, tree);
      case 'mixedContent':
        return new MixedContentSourceAdapter(type, registry, forceIgnore, tree);
      case 'digitalExperience':
        return new DigitalExperienceSourceAdapter(type, registry, forceIgnore, tree);
      case 'default':
      case undefined:
        return new DefaultSourceAdapter(type, registry, forceIgnore, tree);
      default:
        throw new SfError(
          messages.getMessage('error_missing_adapter', [type.strategies?.adapter, type.name]),
          'RegistryError'
        );
    }
  };
