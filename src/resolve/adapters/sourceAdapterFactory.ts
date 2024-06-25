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
import { BundleSourceAdapter } from './bundleSourceAdapter';
import { DecomposedSourceAdapter } from './decomposedSourceAdapter';
import { MatchingContentSourceAdapter } from './matchingContentSourceAdapter';
import { MixedContentSourceAdapter } from './mixedContentSourceAdapter';
import { DefaultSourceAdapter } from './defaultSourceAdapter';
import { DigitalExperienceSourceAdapter } from './digitalExperienceSourceAdapter';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

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
