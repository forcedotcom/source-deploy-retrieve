/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MatchingContentFile } from './matchingContentFile';
import { SourceAdapter } from '../../types';
import { MetadataType } from '../types';
import { Bundle } from './bundle';
import { BaseSourceAdapter } from './base';
import { MixedContent } from './mixedContent';
import { RegistryError } from '../../errors';

export enum AdapterId {
  Bundle = 'bundle',
  MatchingContentFile = 'matchingContentFile',
  MixedContent = 'mixedContent'
}

export const getAdapter = (
  type: MetadataType,
  adapterId: AdapterId
): SourceAdapter => {
  switch (adapterId) {
    case AdapterId.Bundle:
      return new Bundle(type);
    case AdapterId.MatchingContentFile:
      return new MatchingContentFile(type);
    case AdapterId.MixedContent:
      return new MixedContent(type);
    case undefined:
      return new BaseSourceAdapter(type);
    default:
      throw new RegistryError('error_missing_adapter', [type.name, adapterId]);
  }
};
