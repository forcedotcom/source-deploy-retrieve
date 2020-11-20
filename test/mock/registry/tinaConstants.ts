/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { basename, join } from 'path';
import { mockRegistryData } from '.';
import { SourceComponent } from '../../../src';

// Mixed content type in folders
const type = mockRegistryData.types.tinafey;

export const TINA_DIR = join('path', 'to', 'tinas');
export const TINA_FOLDER = join(TINA_DIR, 'A_Folder');
export const TINA_FOLDER_XML = join(TINA_DIR, 'A_Folder.tinafeyFolder-meta.xml');
export const TINA_XML_NAMES = ['a.tina-meta.xml', 'b.tina-meta.xml'];
export const TINA_XML_PATHS = TINA_XML_NAMES.map((n) => join(TINA_FOLDER, n));
export const TINA_SOURCE_NAMES = ['a.x', 'b.y'];
export const TINA_SOURCE_PATHS = TINA_SOURCE_NAMES.map((n) => join(TINA_FOLDER, n));
export const TINA_FOLDER_COMPONENT = SourceComponent.createVirtualComponent(
  {
    name: 'A_Folder',
    type: mockRegistryData.types.tinafeyfolder,
    xml: TINA_FOLDER_XML,
  },
  [
    {
      dirPath: TINA_FOLDER,
      children: [basename(TINA_FOLDER_XML)],
    },
  ]
);
export const TINA_COMPONENTS = [
  new SourceComponent({
    name: 'A_Folder/a',
    type,
    xml: TINA_XML_PATHS[0],
    content: TINA_SOURCE_PATHS[0],
  }),
  new SourceComponent({
    name: 'A_Folder/b',
    type,
    xml: TINA_XML_PATHS[1],
    content: TINA_SOURCE_PATHS[1],
  }),
];
