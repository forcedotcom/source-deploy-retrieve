/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Messages, SfError } from '@salesforce/core';
import { MetadataType } from '../../registry/types';
import { getBundleComponent } from './bundleSourceAdapter';
import { getDecomposedComponent } from './decomposedSourceAdapter';
import { getMatchingContentComponent } from './matchingContentSourceAdapter';
import { getMixedContentComponent } from './mixedContentSourceAdapter';
import { getDefaultComponent } from './defaultSourceAdapter';
import { getDigitalExperienceComponent } from './digitalExperienceSourceAdapter';
import { MaybeGetComponent } from './types';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

/** Returns a function with a common interface that can resolve the given type */
export const adapterSelector = (type: MetadataType): MaybeGetComponent => {
  switch (type.strategies?.adapter) {
    case 'bundle':
      return getBundleComponent;
    case 'decomposed':
      return getDecomposedComponent;
    case 'matchingContentFile':
      return getMatchingContentComponent;
    case 'mixedContent':
      return getMixedContentComponent;
    case 'digitalExperience':
      return getDigitalExperienceComponent;
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
