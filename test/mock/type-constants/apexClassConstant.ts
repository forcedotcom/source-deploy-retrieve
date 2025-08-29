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
import { join } from 'node:path';
import { registry, SourceComponent, VirtualTreeContainer } from '../../../src';
import { META_XML_SUFFIX } from '../../../src/common';

// Constants for a matching content file type (ApexClass)
const type = registry.types.apexclass;

export const TYPE_DIRECTORY = join('path', 'to', type.directoryName);
export const COMPONENT_NAMES = ['myComponent', 'myOtherComponent'];
export const XML_NAMES = COMPONENT_NAMES.map((name) => `${name}.${type.suffix}${META_XML_SUFFIX}`);
export const XML_PATHS = XML_NAMES.map((name) => join(TYPE_DIRECTORY, name));
export const CONTENT_NAMES = COMPONENT_NAMES.map((name) => `${name}.${type.suffix}`);
export const CONTENT_PATHS = CONTENT_NAMES.map((name) => join(TYPE_DIRECTORY, name));

const TREE = new VirtualTreeContainer([
  {
    dirPath: TYPE_DIRECTORY,
    children: XML_NAMES.concat(CONTENT_NAMES),
  },
]);

export const COMPONENTS = COMPONENT_NAMES.map(
  (name, index) =>
    new SourceComponent(
      {
        name,
        type,
        xml: XML_PATHS[index],
        content: CONTENT_PATHS[index],
      },
      TREE
    )
);
export const COMPONENT = COMPONENTS[0];

export const CONTENT_COMPONENT = new SourceComponent({
  name: 'myComponent',
  type,
  xml: CONTENT_PATHS[0],
});
