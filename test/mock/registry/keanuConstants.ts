/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'path';
import { mockRegistryData } from '.';
import { SourceComponent } from '../../../src';

// Constants for a matching content file type
const type = mockRegistryData.types.keanureeves;

export const KEANUS_DIR = join('path', 'to', 'keanus');
export const KEANU_XML_NAMES = ['a.keanu-meta.xml', 'b.keanu-meta.xml'];
export const KEANU_SOURCE_NAMES = ['a.keanu', 'b.keanu'];
export const KEANU_XML_PATHS = KEANU_XML_NAMES.map((n) => join(KEANUS_DIR, n));
export const KEANU_SOURCE_PATHS = KEANU_SOURCE_NAMES.map((n) => join(KEANUS_DIR, n));
export const KEANU_COMPONENT = SourceComponent.createVirtualComponent(
  {
    name: 'a',
    type,
    xml: KEANU_XML_PATHS[0],
    content: KEANU_SOURCE_PATHS[0],
  },
  [
    {
      dirPath: KEANUS_DIR,
      children: KEANU_XML_NAMES.concat(KEANU_SOURCE_NAMES),
    },
  ]
);
export const KEANU_CONTENT_COMPONENT = new SourceComponent({
  name: 'a',
  type,
  xml: KEANU_SOURCE_PATHS[0],
});
