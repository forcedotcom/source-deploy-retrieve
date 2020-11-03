/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'path';
import { mockRegistryData } from '.';
import { SourceComponent } from '../../../src';

// Constants for a type that uses the BaseSourceAdapter and is inFolder
const type = mockRegistryData.types.kathybates;

export const KATHYS_DIR = join('path', 'to', 'kathys');
export const KATHY_FOLDER = join(KATHYS_DIR, 'A_Folder');
export const KATHY_XML_NAMES = ['a.kathy-meta.xml', 'b.kathy-meta.xml', 'c.kathy-meta.xml'];
export const KATHY_XML_PATHS = [
  join(KATHY_FOLDER, 'a.kathy-meta.xml'),
  join(KATHY_FOLDER, 'b.kathy-meta.xml'),
  join(KATHY_FOLDER, 'c.kathy-meta.xml'),
];
export const KATHY_COMPONENTS: SourceComponent[] = [
  new SourceComponent({
    name: `A_Folder/a`,
    type,
    xml: KATHY_XML_PATHS[0],
  }),
  new SourceComponent({
    name: 'A_Folder/b',
    type,
    xml: KATHY_XML_PATHS[1],
  }),
  new SourceComponent({
    name: 'A_Folder/c',
    type,
    xml: KATHY_XML_PATHS[2],
  }),
];

export const KATHY_MD_FORMAT_XML_NAMES = ['a.kathy', 'b.kathy', 'c.kathy'];
export const KATHY_MD_FORMAT_XML_PATHS = [
  join(KATHY_FOLDER, KATHY_MD_FORMAT_XML_NAMES[0]),
  join(KATHY_FOLDER, KATHY_MD_FORMAT_XML_NAMES[1]),
  join(KATHY_FOLDER, KATHY_MD_FORMAT_XML_NAMES[2]),
];
export const KATHY_MD_FORMAT_COMPONENTS: SourceComponent[] = [
  new SourceComponent({
    name: `A_Folder/a`,
    type,
    xml: KATHY_MD_FORMAT_XML_PATHS[0],
  }),
  new SourceComponent({
    name: 'A_Folder/b',
    type,
    xml: KATHY_MD_FORMAT_XML_PATHS[1],
  }),
  new SourceComponent({
    name: 'A_Folder/c',
    type,
    xml: KATHY_MD_FORMAT_XML_PATHS[2],
  }),
];
