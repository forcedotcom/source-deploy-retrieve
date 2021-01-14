/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'path';
import { mockRegistryData } from '.';
import { baseName } from '../../../src/utils';
import { SourceComponent, VirtualDirectory } from '../../../src';
import { XML_NS_URL } from '../../../src/common';

// Constants for a decomposed type
const type = mockRegistryData.types.reginaking;

export const REGINAS_PATH = join('path', 'to', 'reginas');
export const REGINA_PATH = join(REGINAS_PATH, 'a');
export const REGINA_XML_NAME = 'a.regina-meta.xml';
export const REGINA_XML_PATH = join(REGINA_PATH, REGINA_XML_NAME);
export const REGINA_CHILD_XML_NAME_1 = 'z.y-meta.xml';
export const REGINA_CHILD_XML_PATH_1 = join(REGINA_PATH, REGINA_CHILD_XML_NAME_1);
export const REGINA_CHILD_DIR = 'xs';
export const REGINA_CHILD_DIR_PATH = join(REGINA_PATH, REGINA_CHILD_DIR);
export const REGINA_CHILD_XML_NAME_2 = 'w.x-meta.xml';
export const REGINA_CHILD_XML_PATH_2 = join(REGINA_CHILD_DIR_PATH, REGINA_CHILD_XML_NAME_2);
export const REGINA_VIRTUAL_FS: VirtualDirectory[] = [
  {
    dirPath: REGINA_PATH,
    children: [
      {
        name: REGINA_XML_NAME,
        data: Buffer.from(`<ReginaKing xmlns="${XML_NS_URL}"><fullName>a</fullName></ReginaKing>`),
      },
      { name: REGINA_CHILD_XML_NAME_1, data: Buffer.from('<Y><test>child1</test></Y>') },
      REGINA_CHILD_DIR,
    ],
  },
  {
    dirPath: REGINA_CHILD_DIR_PATH,
    children: [{ name: REGINA_CHILD_XML_NAME_2, data: Buffer.from('<X><test>child2</test></X>') }],
  },
];
export const REGINA_COMPONENT = SourceComponent.createVirtualComponent(
  {
    name: baseName(REGINA_XML_PATH),
    type,
    xml: REGINA_XML_PATH,
    content: REGINA_PATH,
  },
  REGINA_VIRTUAL_FS
);
export const REGINA_CHILD_COMPONENT_1 = SourceComponent.createVirtualComponent(
  {
    name: baseName(REGINA_CHILD_XML_NAME_1),
    type: type.children.types.y,
    xml: REGINA_CHILD_XML_PATH_1,
    parent: REGINA_COMPONENT,
  },
  REGINA_VIRTUAL_FS
);
export const REGINA_CHILD_COMPONENT_2 = SourceComponent.createVirtualComponent(
  {
    name: baseName(REGINA_CHILD_XML_NAME_2),
    type: type.children.types.x,
    xml: REGINA_CHILD_XML_PATH_2,
    parent: REGINA_COMPONENT,
  },
  REGINA_VIRTUAL_FS
);
