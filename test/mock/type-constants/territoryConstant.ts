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
