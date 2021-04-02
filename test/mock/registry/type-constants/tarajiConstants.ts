/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join, basename, dirname } from 'path';
import { mockRegistryData } from '../mockRegistry';
import { SourceComponent } from '../../../../src';

// Mixed content with directory as content
const type = mockRegistryData.types.tarajihenson;

export const TARAJI_DIR = join('path', 'to', 'tarajis');
export const TARAJI_CONTENT_PATH = join(TARAJI_DIR, 'a');
export const TARAJI_XML_NAMES = ['a.taraji-meta.xml'];
export const TARAJI_XML_PATHS = TARAJI_XML_NAMES.map((n) => join(TARAJI_DIR, n));
export const TARAJI_SOURCE_PATHS = [
  join(TARAJI_CONTENT_PATH, 'test.xyz'),
  join(TARAJI_CONTENT_PATH, 'b', 'test.g'),
  join(TARAJI_CONTENT_PATH, 'b', 'test2.w'),
];
export const TARAJI_COMPONENT: SourceComponent = new SourceComponent({
  name: 'a',
  type,
  xml: TARAJI_XML_PATHS[0],
  content: TARAJI_CONTENT_PATH,
});
export const TARAJI_VIRTUAL_FS = [
  {
    dirPath: TARAJI_DIR,
    children: [TARAJI_XML_NAMES[0], basename(TARAJI_CONTENT_PATH)],
  },
  {
    dirPath: TARAJI_CONTENT_PATH,
    children: [basename(TARAJI_SOURCE_PATHS[0]), basename(dirname(TARAJI_SOURCE_PATHS[1]))],
  },
  {
    dirPath: dirname(TARAJI_SOURCE_PATHS[1]),
    children: [basename(TARAJI_SOURCE_PATHS[1]), basename(TARAJI_SOURCE_PATHS[2])],
  },
];
export const TARAJI_VIRTUAL_FS_NO_XML = [
  {
    dirPath: TARAJI_DIR,
    children: [basename(TARAJI_CONTENT_PATH)],
  },
  {
    dirPath: TARAJI_CONTENT_PATH,
    children: [basename(TARAJI_SOURCE_PATHS[0]), basename(dirname(TARAJI_SOURCE_PATHS[1]))],
  },
  {
    dirPath: dirname(TARAJI_SOURCE_PATHS[1]),
    children: [basename(TARAJI_SOURCE_PATHS[1]), basename(TARAJI_SOURCE_PATHS[2])],
  },
];
