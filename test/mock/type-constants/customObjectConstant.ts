/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'node:path';
import { assert } from 'chai';
import { baseName } from '../../../src/utils';
import { registry, SourceComponent, VirtualDirectory } from '../../../src';
import { XML_NS_URL } from '../../../src/common';

// Constants for a decomposed type
const type = registry.types.customobject;
// 2 asserts to guard againt future changes to the registry (TS needs these to trust it, since registry is mushy JSON, not a static type)
assert(type.children?.types.validationrule);
assert(type.children.types.customfield);

export const DECOMPOSEDS_PATH = join('path', 'to', 'objects');
export const DECOMPOSED_PATH = join(DECOMPOSEDS_PATH, 'customObject__c');
export const DECOMPOSED_XML_NAME = 'customObject__c.object-meta.xml';
export const DECOMPOSED_XML_PATH = join(DECOMPOSED_PATH, DECOMPOSED_XML_NAME);
export const DECOMPOSED_CHILD_XML_NAME_1 = 'Fields__c.field-meta.xml';
export const DECOMPOSED_CHILD_XML_PATH_1 = join(DECOMPOSED_PATH, DECOMPOSED_CHILD_XML_NAME_1);
export const DECOMPOSED_CHILD_DIR = 'validationRules';
export const DECOMPOSED_CHILD_DIR_PATH = join(DECOMPOSED_PATH, DECOMPOSED_CHILD_DIR);
export const DECOMPOSED_CHILD_XML_NAME_2 = 'myValidationRule.validationRule-meta.xml';
export const DECOMPOSED_CHILD_XML_PATH_2 = join(DECOMPOSED_CHILD_DIR_PATH, DECOMPOSED_CHILD_XML_NAME_2);
export const DECOMPOSED_VIRTUAL_FS: VirtualDirectory[] = [
  {
    dirPath: DECOMPOSED_PATH,
    children: [
      {
        name: DECOMPOSED_XML_NAME,
        data: Buffer.from(`<CustomObject xmlns="${XML_NS_URL}"><fullName>customObject__c</fullName></CustomObject>`),
      },
      {
        name: DECOMPOSED_CHILD_XML_NAME_1,
        data: Buffer.from(`<CustomField xmlns="${XML_NS_URL}"><fullName>child1</fullName></CustomField>`),
      },
      DECOMPOSED_CHILD_DIR,
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
    dirPath: 'fields',
    children: [
      {
        name: DECOMPOSED_CHILD_XML_NAME_1,
        data: Buffer.from('<CustomField><fullName>child3</fullName></CustomField>'),
      },
    ],
  },
];
export const DECOMPOSED_COMPONENT = SourceComponent.createVirtualComponent(
  {
    name: baseName(DECOMPOSED_XML_PATH),
    type,
    xml: DECOMPOSED_XML_PATH,
    content: DECOMPOSED_PATH,
  },
  DECOMPOSED_VIRTUAL_FS
);

export const DECOMPOSED_CHILD_COMPONENT_1 = SourceComponent.createVirtualComponent(
  {
    name: baseName(DECOMPOSED_CHILD_XML_NAME_1),
    type: type.children.types.customfield,
    xml: DECOMPOSED_CHILD_XML_PATH_1,
    parent: DECOMPOSED_COMPONENT,
  },
  DECOMPOSED_VIRTUAL_FS
);
export const DECOMPOSED_CHILD_COMPONENT_2 = SourceComponent.createVirtualComponent(
  {
    name: baseName(DECOMPOSED_CHILD_XML_NAME_2),
    type: type.children.types.validationrule,
    xml: DECOMPOSED_CHILD_XML_PATH_2,
    parent: DECOMPOSED_COMPONENT,
  },
  DECOMPOSED_VIRTUAL_FS
);
