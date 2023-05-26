/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { basename, dirname, join } from 'path';
import { registry, SourceComponent } from '../../../src';

// Mixed content with directory as content
const type = registry.types.staticresource;

export const MIXED_CONTENT_DIRECTORY_DIR = join('path', 'to', 'staticresources');
export const MIXED_CONTENT_DIRECTORY_CONTENT_DIR = join(MIXED_CONTENT_DIRECTORY_DIR, 'aStaticResource');
export const MIXED_CONTENT_DIRECTORY_CONTENT_PATH = join(MIXED_CONTENT_DIRECTORY_DIR, 'aStaticResource.json');
export const MIXED_CONTENT_DIRECTORY_XML_NAMES = ['aStaticResource.resource-meta.xml'];
export const MIXED_CONTENT_DIRECTORY_XML_PATHS = MIXED_CONTENT_DIRECTORY_XML_NAMES.map((n) =>
  join(MIXED_CONTENT_DIRECTORY_DIR, n)
);
export const MIXED_CONTENT_DIRECTORY_SOURCE_PATHS = [
  join(MIXED_CONTENT_DIRECTORY_CONTENT_PATH, 'test.css'),
  join(MIXED_CONTENT_DIRECTORY_CONTENT_PATH, 'tests', 'test.js'),
  join(MIXED_CONTENT_DIRECTORY_CONTENT_PATH, 'tests', 'test2.pdf'),
];
export const MIXED_CONTENT_DIRECTORY_COMPONENT: SourceComponent = new SourceComponent({
  name: 'aStaticResource',
  type,
  xml: MIXED_CONTENT_DIRECTORY_XML_PATHS[0],
  content: MIXED_CONTENT_DIRECTORY_CONTENT_PATH,
});
export const MIXED_CONTENT_DIRECTORY_VIRTUAL_FS = [
  {
    dirPath: MIXED_CONTENT_DIRECTORY_DIR,
    children: [MIXED_CONTENT_DIRECTORY_XML_NAMES[0], basename(MIXED_CONTENT_DIRECTORY_CONTENT_PATH)],
  },
  {
    dirPath: MIXED_CONTENT_DIRECTORY_CONTENT_PATH,
    children: [
      basename(MIXED_CONTENT_DIRECTORY_SOURCE_PATHS[0]),
      basename(dirname(MIXED_CONTENT_DIRECTORY_SOURCE_PATHS[1])),
    ],
  },
  {
    dirPath: dirname(MIXED_CONTENT_DIRECTORY_SOURCE_PATHS[1]),
    children: [basename(MIXED_CONTENT_DIRECTORY_SOURCE_PATHS[1]), basename(MIXED_CONTENT_DIRECTORY_SOURCE_PATHS[2])],
  },
];
export const MIXED_CONTENT_DIRECTORY_VIRTUAL_FS_NO_XML = [
  {
    dirPath: MIXED_CONTENT_DIRECTORY_DIR,
    children: [basename(MIXED_CONTENT_DIRECTORY_CONTENT_PATH)],
  },
  {
    dirPath: MIXED_CONTENT_DIRECTORY_CONTENT_PATH,
    children: [
      basename(MIXED_CONTENT_DIRECTORY_SOURCE_PATHS[0]),
      basename(dirname(MIXED_CONTENT_DIRECTORY_SOURCE_PATHS[1])),
    ],
  },
  {
    dirPath: dirname(MIXED_CONTENT_DIRECTORY_SOURCE_PATHS[1]),
    children: [basename(MIXED_CONTENT_DIRECTORY_SOURCE_PATHS[1]), basename(MIXED_CONTENT_DIRECTORY_SOURCE_PATHS[2])],
  },
];
