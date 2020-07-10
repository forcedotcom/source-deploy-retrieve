/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'path';
import { SourceComponent } from '../../../src/types';
import { mockRegistry } from '.';
import { baseName } from '../../../src/utils';
import { StandardSourceComponent } from '../../../src/metadata-registry';

// Constants for a decomposed type
const type = mockRegistry.types.reginaking;

export const REGINA_PATH = join('path', 'to', 'reginas', 'a');
export const REGINA_XML_NAME = 'a.regina-meta.xml';
export const REGINA_XML_PATH = join(REGINA_PATH, REGINA_XML_NAME);
export const REGINA_CHILD_XML_NAME_1 = 'z.y-meta.xml';
export const REGINA_CHILD_XML_PATH_1 = join(REGINA_PATH, REGINA_CHILD_XML_NAME_1);
export const REGINA_CHILD_DIR = 'xs';
export const REGINA_CHILD_DIR_PATH = join(REGINA_PATH, REGINA_CHILD_DIR);
export const REGINA_CHILD_XML_NAME_2 = 'w.x-meta.xml';
export const REGINA_CHILD_XML_PATH_2 = join(REGINA_CHILD_DIR_PATH, REGINA_CHILD_XML_NAME_2);
export const REGINA_VIRTUAL_FS = [
  {
    dirPath: REGINA_PATH,
    children: [REGINA_XML_NAME, REGINA_CHILD_XML_NAME_1, REGINA_CHILD_DIR]
  },
  {
    dirPath: REGINA_CHILD_DIR_PATH,
    children: [REGINA_CHILD_XML_NAME_2]
  }
];
export const REGINA_COMPONENT: SourceComponent = StandardSourceComponent.createVirtualComponent(
  {
    name: baseName(REGINA_XML_PATH),
    type,
    xml: REGINA_XML_PATH
  },
  REGINA_VIRTUAL_FS
);
