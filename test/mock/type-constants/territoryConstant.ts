/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'node:path';

import { registry, SourceComponent } from '../../../src';

const parentType = registry.types.territory2model;
const childType = registry.types.territory2rule;

export const PARENT_COMPONENT_NAME = 'parentName';
export const PARENT_TYPE_DIRECTORY = join('path', 'to', parentType.directoryName);
export const PARENT_CONTENT_PATH = join(PARENT_TYPE_DIRECTORY, PARENT_COMPONENT_NAME);
export const PARENT_XML_NAME = `${PARENT_COMPONENT_NAME}.${parentType.suffix}-meta.xml`;
export const PARENT_XML_PATH = join(PARENT_CONTENT_PATH, PARENT_XML_NAME);

export const CHILD_COMPONENT_NAME = 'childName';
// /Territory2Models/someModel/rules
export const CHILD_TYPE_DIRECTORY = join(PARENT_CONTENT_PATH, childType.directoryName);
export const CHILD_XML_NAME = `${CHILD_COMPONENT_NAME}.${childType.suffix}-meta.xml`;
export const CHILD_XML_PATH = join(CHILD_TYPE_DIRECTORY, CHILD_XML_NAME);

export const NESTED_PARENT_COMPONENT = SourceComponent.createVirtualComponent(
  {
    name: PARENT_COMPONENT_NAME,
    type: parentType,
    xml: PARENT_XML_PATH,
    parentType,
  },
  []
);

export const NESTED_CHILD_COMPONENT = SourceComponent.createVirtualComponent(
  {
    name: `${PARENT_COMPONENT_NAME}.${CHILD_COMPONENT_NAME}`,
    type: childType,
    xml: CHILD_XML_PATH,
    parentType,
  },
  []
);
