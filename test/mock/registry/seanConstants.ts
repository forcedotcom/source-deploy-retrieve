/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'path';
import { mockRegistryData } from '.';
import { SourceComponent } from '../../../src/metadata-registry';

// Constants for a type that uses the BaseSourceAdapter and is inFolder
const type = mockRegistryData.types.seanconnerys;

export const SEAN_DIR = join('path', 'to', 'seans');
export const SEAN_FOLDER = join(SEAN_DIR, 'A_Folder');
export const SEAN_NAMES = ['a.sean', 'b.sean', 'c.sean'];
export const SEAN_PATHS = SEAN_NAMES.map((p) => join(SEAN_FOLDER, p));
export const SEAN_COMPONENTS: SourceComponent[] = [
  new SourceComponent({
    name: `A_Folder/a`,
    type,
    xml: SEAN_PATHS[0],
  }),
  new SourceComponent({
    name: 'A_Folder/b',
    type,
    xml: SEAN_PATHS[1],
  }),
  new SourceComponent({
    name: 'A_Folder/c',
    type,
    xml: SEAN_PATHS[2],
  }),
];
