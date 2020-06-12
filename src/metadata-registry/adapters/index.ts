/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MatchingContentSourceAdapter } from './matchingContentSourceAdapter';
import { SourceAdapter, MetadataType } from '../../types';
import { BundleSourceAdapter } from './bundleSourceAdapter';
// import { BaseSourceAdapter } from './baseSourceAdapter';
import { MixedContentSourceAdapter } from './mixedContentSourceAdapter';
import { RegistryError } from '../../errors';
import { ForceIgnore } from '../forceIgnore';
import { DecomposedSourceAdapter } from './decomposedSourceAdapter';
import { DefaultSourceAdapter } from './defaultSourceAdapter';

export enum AdapterId {
  Bundle = 'bundle',
  Decomposed = 'decomposed',
  MatchingContentFile = 'matchingContentFile',
  MixedContent = 'mixedContent'
}

export const getAdapter = (
  type: MetadataType,
  adapterId: AdapterId,
  forceIgnore?: ForceIgnore
): SourceAdapter => {
  switch (adapterId) {
    case AdapterId.Bundle:
      return new BundleSourceAdapter(type, undefined, forceIgnore);
    case AdapterId.Decomposed:
      return new DecomposedSourceAdapter(type, undefined, forceIgnore);
    case AdapterId.MatchingContentFile:
      return new MatchingContentSourceAdapter(type, undefined, forceIgnore);
    case AdapterId.MixedContent:
      return new MixedContentSourceAdapter(type, undefined, forceIgnore);
    case undefined:
      return new DefaultSourceAdapter(type, undefined, forceIgnore);
    default:
      throw new RegistryError('error_missing_adapter', [type.name, adapterId]);
  }
};
