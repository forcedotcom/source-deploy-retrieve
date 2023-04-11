/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'path';
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
