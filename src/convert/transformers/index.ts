/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { MetadataTransformer, MetadataComponent } from '../../types';
import { DefaultTransformer } from './default';

export function getTransformer(component: MetadataComponent): MetadataTransformer {
  return new DefaultTransformer(component);
}
