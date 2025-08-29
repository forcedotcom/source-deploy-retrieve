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
import { baseName } from '../../../src/utils';

export const DECOMPOSED_TOP_LEVEL_DIR = join('path', 'to', 'objectTranslations');
export const DECOMPOSED_TOP_LEVEL_COMPONENT_PATH = join(DECOMPOSED_TOP_LEVEL_DIR, 'myObject__c');
export const DECOMPOSED_TOP_LEVEL_XML_NAMES = ['myObject__c.objectTranslation-meta.xml'];
export const DECOMPOSED_TOP_LEVEL_XML_PATH = join(
  DECOMPOSED_TOP_LEVEL_COMPONENT_PATH,
  DECOMPOSED_TOP_LEVEL_XML_NAMES[0]
);
export const DECOMPOSED_TOP_LEVEL_CHILD_XML_NAMES = [
  'Account.fieldTranslation-meta.xml',
  'Opportunity.fieldTranslation-meta.xml',
];
DECOMPOSED_TOP_LEVEL_CHILD_XML_NAMES.map((n) => join(DECOMPOSED_TOP_LEVEL_COMPONENT_PATH, n));
export const DECOMPOSED_TOP_LEVEL_CHILD_XML_PATHS = DECOMPOSED_TOP_LEVEL_CHILD_XML_NAMES.map((n) =>
  join(DECOMPOSED_TOP_LEVEL_COMPONENT_PATH, n)
);
export const DECOMPOSED_VIRTUAL_FS = [
  {
    dirPath: DECOMPOSED_TOP_LEVEL_COMPONENT_PATH,
    children: [
      DECOMPOSED_TOP_LEVEL_XML_NAMES[0],
      DECOMPOSED_TOP_LEVEL_CHILD_XML_NAMES[0],
      DECOMPOSED_TOP_LEVEL_CHILD_XML_NAMES[1],
    ],
  },
];

export const DECOMPOSED_TOP_LEVEL_COMPONENT = SourceComponent.createVirtualComponent(
  {
    name: baseName(DECOMPOSED_TOP_LEVEL_XML_PATH),
    type: registry.types.customobjecttranslation,
    xml: DECOMPOSED_TOP_LEVEL_XML_PATH,
    content: DECOMPOSED_TOP_LEVEL_COMPONENT_PATH,
  },
  DECOMPOSED_VIRTUAL_FS
);
