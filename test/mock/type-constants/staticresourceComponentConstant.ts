/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'node:path';

import { registry, SourceComponent } from '../../../src';
import { META_XML_SUFFIX } from '../../../src/common';

const type = registry.types.staticresource;

export const TYPE_DIRECTORY = join('path', 'to', type.directoryName);
export const COMPONENT_NAMES = ['aStaticResource'];
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
