/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as data from './data/registry.json';
import { deepFreeze } from '../utils/registry';
export { RegistryAccess } from './registryAccess';
export { ManifestGenerator } from './manifestGenerator';
export { BaseTreeContainer, NodeFSTreeContainer, VirtualTreeContainer } from './treeContainers';
export { SourceComponent } from './sourceComponent';

/**
 * Direct access to the JSON registry data. Useful for autocompletions.
 */
export const registryData = deepFreeze(data);
