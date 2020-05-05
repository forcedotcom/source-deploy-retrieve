/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MatchingContentFile } from './matchingContentFile';
import { SourceAdapter, MetadataType } from '../../types';
import { Bundle } from './bundle';
import { BaseSourceAdapter } from './base';
import { MixedContent } from './mixedContent';
import { RegistryError } from '../../errors';
import { ForceIgnore } from '../forceIgnore';

export enum AdapterId {
  Bundle = 'bundle',
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
      return new Bundle(type, undefined, forceIgnore);
    case AdapterId.MatchingContentFile:
      return new MatchingContentFile(type, undefined, forceIgnore);
    case AdapterId.MixedContent:
      return new MixedContent(type, undefined, forceIgnore);
    case undefined:
      return new BaseSourceAdapter(type, undefined, forceIgnore);
    default:
      throw new RegistryError('error_missing_adapter', [type.name, adapterId]);
  }
};
