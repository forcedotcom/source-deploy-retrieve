/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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
