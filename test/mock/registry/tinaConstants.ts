/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'path';
import { mockRegistry } from '.';
import { MetadataComponent } from '../../../src/types';

// Mixed content type in folders
const type = mockRegistry.types.tinafey;

export const TINA_DIR = join('path', 'to', 'tinas');
export const TINA_FOLDER = join(TINA_DIR, 'A_Folder');
export const TINA_FOLDER_XML = join(TINA_DIR, 'A_Folder.tinafeyFolder-meta.xml');
export const TINA_XML_NAMES = ['a.tina-meta.xml', 'b.tina-meta.xml'];
export const TINA_XML_PATHS = TINA_XML_NAMES.map(n => join(TINA_FOLDER, n));
export const TINA_SOURCE_NAMES = ['a.x', 'b.y'];
export const TINA_SOURCE_PATHS = TINA_SOURCE_NAMES.map(n => join(TINA_FOLDER, n));
export const TINA_FOLDER_COMPONENT: MetadataComponent = {
  fullName: 'A_Folder',
  type: mockRegistry.types.tinafeyfolder,
  xml: TINA_FOLDER_XML,
  sources: []
};
export const TINA_COMPONENTS = [
  {
    fullName: 'A_Folder/a',
    type,
    xml: TINA_XML_PATHS[0],
    sources: [TINA_SOURCE_PATHS[0]]
  },
  {
    fullName: 'A_Folder/a',
    type,
    xml: TINA_XML_PATHS[1],
    sources: [TINA_SOURCE_PATHS[1]]
  }
];
