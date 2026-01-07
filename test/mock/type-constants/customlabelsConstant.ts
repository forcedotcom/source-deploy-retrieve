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
import { registry, SourceComponent, VirtualDirectory, VirtualTreeContainer } from '../../../src';
import { META_XML_SUFFIX, XML_NS_KEY, XML_NS_URL } from '../../../src/common';
import { JsToXml } from '../../../src/convert/streams';

// Constants for a matching content file type
const type = registry.types.customlabels;

export const WORKING_DIR = join(process.cwd(), 'my-project');

export const DEFAULT_DIR = join(WORKING_DIR, 'force-app');
export const NON_DEFAULT_DIR = join(WORKING_DIR, 'my-app');

export const XML_NAME = `${type.name}.${type.suffix}${META_XML_SUFFIX}`;

export const COMPONENT_1_TYPE_DIR = join(DEFAULT_DIR, 'main', 'default', type.directoryName);
export const COMPONENT_2_TYPE_DIR = join(NON_DEFAULT_DIR, type.directoryName);
export const COMPONENT_1_XML_PATH = join(COMPONENT_1_TYPE_DIR, XML_NAME);
export const COMPONENT_2_XML_PATH = join(COMPONENT_2_TYPE_DIR, XML_NAME);

export const CHILD_1_NAME = 'Child_1';
export const CHILD_2_NAME = 'Child_2';
export const CHILD_3_NAME = 'Child_3';
export const UNCLAIMED_CHILD_NAME = 'Unclaimed_Child';

export const CHILD_1_XML = { fullName: CHILD_1_NAME, shortDescription: 'the first child', value: 'the first child' };
export const CHILD_2_XML = { fullName: CHILD_2_NAME, shortDescription: 'the second child', value: 'the second child' };
export const CHILD_3_XML = { fullName: CHILD_3_NAME, shortDescription: 'the third child', value: 'the third child' };
export const UNCLAIMED_CHILD_XML = {
  fullName: UNCLAIMED_CHILD_NAME,
  shortDescription: 'the unclaimed child',
  value: 'the unclaimed child',
};

export const COMPONENT_1_XML = {
  [type.name]: {
    [XML_NS_KEY]: XML_NS_URL,
    [type.directoryName]: [CHILD_1_XML, CHILD_2_XML],
  },
};

export const COMPONENT_2_XML = {
  [type.name]: {
    [XML_NS_KEY]: XML_NS_URL,
    [type.directoryName]: CHILD_3_XML,
  },
};

export const FULL_XML_CONTENT = {
  [type.name]: {
    [XML_NS_KEY]: XML_NS_URL,
    [type.directoryName]: [CHILD_1_XML, CHILD_2_XML, CHILD_3_XML, UNCLAIMED_CHILD_XML],
  },
};

export const MATCHING_RULES_TYPE = registry.types.matchingrules;
// NOTE: directory name uses the string literal rather than getting from MATCHING_RULES_TYPE
// so it explicitly shows that this matches the xml field
export const MATCHING_RULES_TYPE_DIRECTORY_NAME = MATCHING_RULES_TYPE.directoryName;
export const MATCHING_RULES_XML_NAME = 'Account.matchingRule-meta.xml';
export const MATCHING_RULES_COMPONENT_DIR = join(DEFAULT_DIR, MATCHING_RULES_TYPE_DIRECTORY_NAME);
export const MATCHING_RULES_COMPONENT_XML_PATH = join(MATCHING_RULES_COMPONENT_DIR, MATCHING_RULES_XML_NAME);
export const MATCHING_RULES_COMPONENT_XML = {
  MatchingRules: {
    '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
    matchingRules: {
      fullName: 'My_Account_Matching_Rule',
      booleanFilter: '1 AND 2',
      label: 'My Account Matching Rule',
      matchingRuleItems: [
        {
          blankValueBehavior: 'NullNotAllowed',
          fieldName: 'Name',
          matchingMethod: 'Exact',
        },
        {
          blankValueBehavior: 'NullNotAllowed',
          fieldName: 'BillingCity',
          matchingMethod: 'Exact',
        },
      ],
      ruleStatus: 'Active',
    },
  },
};

export const VIRTUAL_DIR: VirtualDirectory[] = [
  { dirPath: WORKING_DIR, children: [DEFAULT_DIR, NON_DEFAULT_DIR] },
  { dirPath: DEFAULT_DIR, children: ['main'] },
  { dirPath: join(DEFAULT_DIR, 'main'), children: [join(DEFAULT_DIR, 'main', 'default')] },
  {
    dirPath: join(DEFAULT_DIR, 'main', 'default'),
    children: [join(DEFAULT_DIR, 'main', 'default', COMPONENT_1_TYPE_DIR)],
  },
  { dirPath: NON_DEFAULT_DIR, children: [join(NON_DEFAULT_DIR, COMPONENT_2_TYPE_DIR)] },
  {
    dirPath: COMPONENT_1_TYPE_DIR,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    children: [{ name: XML_NAME, data: Buffer.from(new JsToXml(COMPONENT_1_XML).read().toString()) }],
  },
  {
    dirPath: COMPONENT_2_TYPE_DIR,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    children: [{ name: XML_NAME, data: Buffer.from(new JsToXml(COMPONENT_2_XML).read().toString()) }],
  },
  {
    dirPath: MATCHING_RULES_COMPONENT_DIR,
    children: [
      {
        name: MATCHING_RULES_XML_NAME,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        data: Buffer.from(new JsToXml(MATCHING_RULES_COMPONENT_XML).read().toString()),
      },
    ],
  },
];

export const TREE = new VirtualTreeContainer(VIRTUAL_DIR);

export const COMPONENT_1 = new SourceComponent({ name: type.name, type, xml: COMPONENT_1_XML_PATH }, TREE);

export const COMPONENT_2 = new SourceComponent({ name: type.name, type, xml: COMPONENT_2_XML_PATH }, TREE);

export const MATCHING_RULES_COMPONENT = new SourceComponent(
  {
    name: MATCHING_RULES_TYPE.name,
    type: MATCHING_RULES_TYPE,
    xml: MATCHING_RULES_COMPONENT_XML_PATH,
  },
  TREE
);
