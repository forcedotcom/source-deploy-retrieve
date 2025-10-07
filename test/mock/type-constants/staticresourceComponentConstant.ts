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

import { registry, SourceComponent } from '../../../src';
import { META_XML_SUFFIX } from '../../../src/common';

const type = registry.types.staticresource;

export const TYPE_DIRECTORY = join('path', 'to', type.directoryName);
export const COMPONENT_NAMES = ['staticResourceComponent'];
export const XML_NAMES = COMPONENT_NAMES.map((name) => `${name}.${type.suffix}${META_XML_SUFFIX}`);
export const XML_PATHS = XML_NAMES.map((n) => join(TYPE_DIRECTORY, n));
export const CONTENT_NAMES = COMPONENT_NAMES.map((name) => `${name}.json`);
export const CONTENT_PATHS = CONTENT_NAMES.map((n) => join(TYPE_DIRECTORY, n));
export const COMPONENT = SourceComponent.createVirtualComponent(
  {
    name: COMPONENT_NAMES[0],
    type,
    content: CONTENT_PATHS[0],
    xml: XML_PATHS[0],
  },
  [
    {
      dirPath: TYPE_DIRECTORY,
      children: XML_NAMES.concat(CONTENT_NAMES),
    },
  ]
);
