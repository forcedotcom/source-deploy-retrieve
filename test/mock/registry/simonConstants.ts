/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { mockRegistryData } from '.';
import { join } from 'path';
import { SourceComponent } from '../../../src';

// Bundle content
const type = mockRegistryData.types.simonpegg;

export const SIMON_DIR = join('path', 'to', 'simons');
export const SIMON_BUNDLE_PATH = join(SIMON_DIR, 'a');
export const SIMON_XML_NAME = 'a.js-meta.xml';
export const SIMON_XML_PATH = join(SIMON_BUNDLE_PATH, SIMON_XML_NAME);
export const SIMON_SUBTYPE_PATH = join(SIMON_BUNDLE_PATH, 'b.z-meta.xml');
export const SIMON_SOURCE_PATHS = [
  join(SIMON_BUNDLE_PATH, 'a.js'),
  join(SIMON_BUNDLE_PATH, 'a.css'),
  join(SIMON_BUNDLE_PATH, 'a.html'),
];
export const SIMON_COMPONENT = SourceComponent.createVirtualComponent(
  {
    name: 'a',
    type,
    xml: SIMON_XML_PATH,
    content: SIMON_BUNDLE_PATH,
  },
  [
    {
      dirPath: SIMON_BUNDLE_PATH,
      children: [SIMON_XML_NAME, 'a.js', 'a.css', 'a.html'],
    },
  ]
);
