/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { join } from 'path';
import { SourceComponent } from '../../../../src';
import { META_XML_SUFFIX } from '../../../../src/common';
import { mockRegistryData } from '../mockRegistry';

const type = mockRegistryData.types.dwaynejohnson;

export const TYPE_DIRECTORY = join('path', 'to', type.directoryName);
export const COMPONENT_NAMES = ['a'];
export const XML_NAMES = COMPONENT_NAMES.map((name) => `${name}.${type.suffix}${META_XML_SUFFIX}`);
export const XML_PATHS = XML_NAMES.map((name) => join(TYPE_DIRECTORY, name));
export const CONTENT_NAMES = COMPONENT_NAMES.map((name) => `${name}.xyz`);
export const CONTENT_PATHS = CONTENT_NAMES.map((name) => join(TYPE_DIRECTORY, name));
export const COMPONENTS = COMPONENT_NAMES.map(
  (name, index) =>
    new SourceComponent({
      name,
      type,
      content: CONTENT_PATHS[index],
      xml: XML_PATHS[index],
    })
);
