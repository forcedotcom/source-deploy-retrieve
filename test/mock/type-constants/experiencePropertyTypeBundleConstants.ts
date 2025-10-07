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
import { assert } from 'chai';

import { registry, SourceComponent } from '../../../src';

/**
 * Experience Property Type Bundle will be of the following shape:
 *
 * experiencePropertyTypeBundles/
 * ├── prop1/
 * |   ├── schema.json
 * |   ├── design.json
 *
 * schema.json is always expected to be in the bundle, while design.json is optional.
 *
 * NOTE: there is no -meta.xml. schema.json acts as the meta XML file.
 */

// This is the type defined in metadataRegistry.json
const type = registry.types.experiencepropertytypebundle;
assert(type.metaFileSuffix);

// This will be the root directory experiencePropertyTypeBundles.It is something like /path/to/experiencePropertyTypeBundles
export const TYPE_DIRECTORY = join('path', 'to', type.directoryName);

// This is the name of the property type we are creating.
export const COMPONENT_NAME = 'prop1';

// This is the schema.json and design.json paths inside the property type.
export const CONTENT_NAMES = [type.metaFileSuffix, 'design.json'];

// This is the complete path to the content. It is something like /path/to/experiencePropertyTypeBundles/prop1/schema.json.
export const CONTENT_PATHS = CONTENT_NAMES.map((n) => join(TYPE_DIRECTORY, join(COMPONENT_NAME, n)));

// Finally we construct our component.
export const COMPONENT = SourceComponent.createVirtualComponent(
  {
    name: COMPONENT_NAME,
    type,
    content: join(TYPE_DIRECTORY, COMPONENT_NAME),
    xml: CONTENT_PATHS[0],
  },
  [
    {
      dirPath: TYPE_DIRECTORY,
      children: [COMPONENT_NAME],
    },
  ]
);
