/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'path';
import { registry, SourceComponent } from '../../../src';
import { META_XML_SUFFIX } from '../../../src/common';

const type = registry.types.profile;

export const PROFILE_DIRECTORY = join('path', 'to', type.directoryName);
export const COMPONENT_NAME = 'Admin';
export const COMPONENT_SUFFIX = type.suffix;

export const XML_NAME = COMPONENT_NAME + '.' + COMPONENT_SUFFIX + META_XML_SUFFIX;
export const XML_PATH = join(PROFILE_DIRECTORY, XML_NAME);

export const PROFILE = new SourceComponent({
  name: COMPONENT_NAME,
  type,
  xml: XML_PATH,
});

export const PROFILE_VIRTUAL_FS = [
  {
    dirPath: PROFILE_DIRECTORY,
    children: [PROFILE],
  },
];
