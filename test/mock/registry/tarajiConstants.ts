/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'path';
import { SourceComponent } from '../../../src/types';
import { mockRegistry } from '.';
import { StandardSourceComponent } from '../../../src/metadata-registry';

// Mixed content with directory as content
const type = mockRegistry.types.tarajihenson;

export const TARAJI_DIR = join('path', 'to', 'tarajis');
export const TARAJI_CONTENT_PATH = join(TARAJI_DIR, 'a');
export const TARAJI_XML_NAMES = ['a.taraji-meta.xml'];
export const TARAJI_XML_PATHS = TARAJI_XML_NAMES.map(n => join(TARAJI_DIR, n));
export const TARAJI_SOURCE_PATHS = [
  join(TARAJI_CONTENT_PATH, 'test.xyz'),
  join(TARAJI_CONTENT_PATH, 'b', 'test.g'),
  join(TARAJI_CONTENT_PATH, 'b', 'test2.w')
];
export const TARAJI_COMPONENT: SourceComponent = new StandardSourceComponent({
  name: 'a',
  type,
  xml: TARAJI_XML_PATHS[0],
  content: TARAJI_CONTENT_PATH
});
