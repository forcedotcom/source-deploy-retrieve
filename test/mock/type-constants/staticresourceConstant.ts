/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { basename, dirname, join } from 'node:path';
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
export const MIXED_CONTENT_DIRECTORY_COMPONENT = new SourceComponent({
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
