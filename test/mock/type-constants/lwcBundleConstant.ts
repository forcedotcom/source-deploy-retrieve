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
