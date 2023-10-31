/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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
