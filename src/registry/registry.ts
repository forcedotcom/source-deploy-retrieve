/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { deepFreeze } from '../utils/collections';
import * as registryData from './metadataRegistry.json';
import { MetadataRegistry } from './types';

/**
 * The default metadata registry.
 */
export const registry = deepFreeze(registryData as MetadataRegistry);
