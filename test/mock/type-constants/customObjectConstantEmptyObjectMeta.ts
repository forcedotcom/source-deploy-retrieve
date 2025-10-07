/*
 * Copyright 2025, Salesforce, Inc.
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
import { assert } from 'chai';
import { baseName } from '../../../src/utils';
import { registry, SourceComponent, VirtualDirectory } from '../../../src';
import { XML_NS_URL } from '../../../src/common';
import {
  DECOMPOSED_CHILD_DIR_1_PATH,
  DECOMPOSED_CHILD_DIR,
  DECOMPOSED_CHILD_DIR_1,
  DECOMPOSED_CHILD_DIR_PATH,
  DECOMPOSED_CHILD_XML_NAME_2,
  DECOMPOSED_PATH,
  DECOMPOSED_XML_PATH,
  DECOMPOSED_CHILD_XML_PATH_1,
  DECOMPOSED_XML_NAME,
  DECOMPOSED_CHILD_XML_PATH_2,
  DECOMPOSED_CHILD_XML_NAME_1,
} from './customObjectConstant';

// Constants for a decomposed type
const type = registry.types.customobject;
// 2 asserts to guard againt future changes to the registry (TS needs these to trust it, since registry is mushy JSON, not a static type)
assert(type.children?.types.validationrule);
assert(type.children.types.customfield);

export const DECOMPOSED_VIRTUAL_FS_EMPTY: VirtualDirectory[] = [
  {
    dirPath: DECOMPOSED_PATH,
    children: [
      {
        name: DECOMPOSED_XML_NAME,
        data: Buffer.from(`<CustomObject xmlns="${XML_NS_URL}"></CustomObject>`),
      },

      DECOMPOSED_CHILD_DIR,
      DECOMPOSED_CHILD_DIR_1,
    ],
  },
  {
    dirPath: DECOMPOSED_CHILD_DIR_PATH,
    children: [
      {
        name: DECOMPOSED_CHILD_XML_NAME_2,
        data: Buffer.from('<ValidationRule><fullName>child2</fullName></ValidationRule>'),
      },
    ],
  },
  {
    dirPath: DECOMPOSED_CHILD_DIR_1_PATH,
    children: [
      {
        name: DECOMPOSED_CHILD_XML_NAME_1,
        data: Buffer.from(`<CustomField xmlns="${XML_NS_URL}"><fullName>child1</fullName></CustomField>`),
      },
    ],
  },
];
export const DECOMPOSED_COMPONENT_EMPTY = SourceComponent.createVirtualComponent(
  {
    name: baseName(DECOMPOSED_XML_PATH),
    type,
    xml: DECOMPOSED_XML_PATH,
    content: DECOMPOSED_PATH,
  },
  DECOMPOSED_VIRTUAL_FS_EMPTY
);

export const DECOMPOSED_CHILD_COMPONENT_1_EMPTY = SourceComponent.createVirtualComponent(
  {
    name: baseName(DECOMPOSED_CHILD_XML_NAME_1),
    type: type.children.types.customfield,
    xml: DECOMPOSED_CHILD_XML_PATH_1,
    parent: DECOMPOSED_COMPONENT_EMPTY,
  },
  DECOMPOSED_VIRTUAL_FS_EMPTY
);

export const DECOMPOSED_CHILD_COMPONENT_2_EMPTY = SourceComponent.createVirtualComponent(
  {
    name: baseName(DECOMPOSED_CHILD_XML_NAME_2),
    type: type.children.types.validationrule,
    xml: DECOMPOSED_CHILD_XML_PATH_2,
    parent: DECOMPOSED_COMPONENT_EMPTY,
  },
  DECOMPOSED_VIRTUAL_FS_EMPTY
);
