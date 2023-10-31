/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'node:path';
import { registry, SourceComponent } from '../../../src';

const type = registry.types.lightningcomponentbundle;

/**
 * While LWC *can* be identical to Aura bundles, they may also be deeply nested.
 * ex  projDir/lwc/folder1/lwc/cmpA
 * and projDir/lwc/cmpB
 */
export const TYPE_DIRECTORY = join('path', 'to', type.directoryName, 'folder1', type.directoryName);
const COMPONENT_NAME = 'cmpA';
export const CONTENT_PATH = join(TYPE_DIRECTORY, COMPONENT_NAME);
export const XML_NAME = `${COMPONENT_NAME}.js-meta.xml`;
export const XML_PATH = join(CONTENT_PATH, XML_NAME);
export const SUBTYPE_XML_PATH = join(CONTENT_PATH, `${COMPONENT_NAME}.js-meta.xml`);
export const COMPONENTS = [`${COMPONENT_NAME}.js`, `${COMPONENT_NAME}.css`, `${COMPONENT_NAME}.html`];
export const SOURCE_PATHS = COMPONENTS.map((cmp) => join(CONTENT_PATH, cmp));

export const COMPONENT = SourceComponent.createVirtualComponent(
  {
    name: COMPONENT_NAME,
    type,
    xml: XML_PATH,
    content: CONTENT_PATH,
  },
  [
    {
      dirPath: TYPE_DIRECTORY,
      children: [COMPONENT_NAME],
    },
    {
      dirPath: CONTENT_PATH,
      children: [XML_NAME, ...COMPONENTS],
    },
  ]
);

export const EMPTY_BUNDLE = SourceComponent.createVirtualComponent(
  {
    name: COMPONENT_NAME,
    type,
    xml: XML_PATH,
    content: CONTENT_PATH,
  },
  [
    {
      dirPath: TYPE_DIRECTORY,
      children: [COMPONENT_NAME],
    },
    {
      dirPath: CONTENT_PATH,
      children: [],
    },
  ]
);
