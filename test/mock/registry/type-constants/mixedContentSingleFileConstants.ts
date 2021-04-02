/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'path';
import { mockRegistryData } from '../mockRegistry';
import { SourceComponent } from '../../../../src';

const type = mockRegistryData.types.mixedcontentsinglefile;

export const MC_SINGLE_FILE_DIR = join('path', 'to', 'mixedSingleFiles');
export const MC_SINGLE_FILE_XML_NAMES = ['a.mixedSingleFile-meta.xml'];
export const MC_SINGLE_FILE_XML_PATHS = MC_SINGLE_FILE_XML_NAMES.map((n) =>
  join(MC_SINGLE_FILE_DIR, n)
);
export const MC_SINGLE_FILE_SOURCE_NAMES = ['a.x'];
export const MC_SINGLE_FILE_SOURCE_PATHS = MC_SINGLE_FILE_SOURCE_NAMES.map((n) =>
  join(MC_SINGLE_FILE_DIR, n)
);
export const MC_SINGLE_FILE_COMPONENT = SourceComponent.createVirtualComponent(
  {
    name: 'a',
    type,
    content: MC_SINGLE_FILE_SOURCE_PATHS[0],
    xml: MC_SINGLE_FILE_XML_PATHS[0],
  },
  [
    {
      dirPath: MC_SINGLE_FILE_DIR,
      children: MC_SINGLE_FILE_XML_NAMES.concat(MC_SINGLE_FILE_SOURCE_NAMES),
    },
  ]
);
