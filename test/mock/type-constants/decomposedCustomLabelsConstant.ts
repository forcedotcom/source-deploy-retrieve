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

import { SourceComponent, VirtualTreeContainer, presetMap, RegistryAccess } from '../../../src';
import { getEffectiveRegistry } from '../../../src/registry/variants';

// Constants for a matching content file type
export const regAcc = new RegistryAccess(
  getEffectiveRegistry({ presets: [presetMap.get('decomposeCustomLabelsBeta2')!] })
);

const customLabelsType = regAcc.getTypeByName('CustomLabels');
const customLabelType = regAcc.getTypeByName('CustomLabel');

const MDAPI_XML_NAME = 'CustomLabels.labels';

export const EMPTY_CUSTOM_LABELS_CMP = new SourceComponent(
  {
    name: 'CustomLabels',
    type: customLabelsType,
    xml: join('labels', MDAPI_XML_NAME),
  },
  new VirtualTreeContainer([
    {
      dirPath: 'labels',
      children: [
        {
          name: MDAPI_XML_NAME,
          data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<CustomLabels xmlns="http://soap.sforce.com/2006/04/metadata"></CustomLabels>`),
        },
      ],
    },
  ])
);
export const ONE_CUSTOM_LABELS_CMP = new SourceComponent(
  {
    name: 'CustomLabels',
    type: customLabelsType,
    xml: join('labels', MDAPI_XML_NAME),
  },
  new VirtualTreeContainer([
    {
      dirPath: 'labels',
      children: [
        {
          name: MDAPI_XML_NAME,
          data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<CustomLabels xmlns="http://soap.sforce.com/2006/04/metadata">
    <labels>
        <fullName>OnlyLabel</fullName>
        <language>en_US</language>
        <protected>true</protected>
        <shortDescription>OnlyLabel</shortDescription>
        <value>OnlyLabel</value>
    </labels>
</CustomLabels>`),
        },
      ],
    },
  ])
);

export const THREE_CUSTOM_LABELS_CMP = new SourceComponent(
  {
    name: 'CustomLabels',
    type: customLabelsType,
    xml: join('labels', MDAPI_XML_NAME),
  },
  new VirtualTreeContainer([
    {
      dirPath: 'labels',
      children: [
        {
          name: MDAPI_XML_NAME,
          data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<CustomLabels xmlns="http://soap.sforce.com/2006/04/metadata">
    <labels>
        <fullName>DeleteMe</fullName>
        <language>en_US</language>
        <protected>true</protected>
        <shortDescription>DeleteMe</shortDescription>
        <value>Test</value>
    </labels>
    <labels>
        <fullName>KeepMe1</fullName>
        <language>en_US</language>
        <protected>true</protected>
        <shortDescription>KeepMe1</shortDescription>
        <value>Test</value>
    </labels>
    <labels>
        <fullName>KeepMe2</fullName>
        <language>en_US</language>
        <protected>true</protected>
        <shortDescription>KeepMe2</shortDescription>
        <value>Test</value>
    </labels>
</CustomLabels>`),
        },
      ],
    },
  ])
);

const ONLY_LABEL_CONTENTS = `<?xml version="1.0" encoding="UTF-8"?>
<CustomLabel xmlns="http://soap.sforce.com/2006/04/metadata">
  <fullName>OnlyLabel</fullName>
  <language>en_US</language>
  <protected>true</protected>
  <shortDescription>OnlyLabel</shortDescription>
  <value>OnlyLabel</value>
</CustomLabel>`;

export const ONLY_LABEL_CMP_IN_DEFAULT_DIR_CMP = new SourceComponent(
  {
    name: 'OnlyLabel',
    type: customLabelType,
    xml: join('main', 'default', 'labels', 'OnlyLabel.label-meta.xml'),
  },
  new VirtualTreeContainer([
    {
      dirPath: join('main', 'default', 'labels'),
      children: [
        {
          name: 'OnlyLabel.label-meta.xml',
          data: Buffer.from(ONLY_LABEL_CONTENTS),
        },
      ],
    },
  ])
);

export const ONLY_LABEL_CMP_IN_ANOTHER_DIR_CMP = new SourceComponent(
  {
    name: 'OnlyLabel',
    type: customLabelType,
    xml: join('other', 'dir', 'labels', 'OnlyLabel.label-meta.xml'),
  },
  new VirtualTreeContainer([
    {
      dirPath: join('other', 'dir', 'labels'),
      children: [
        {
          name: 'OnlyLabel.label-meta.xml',
          data: Buffer.from(ONLY_LABEL_CONTENTS),
        },
      ],
    },
  ])
);

export const ONLY_LABEL_NO_DIR_CMP = new SourceComponent(
  {
    name: 'OnlyLabel',
    type: customLabelType,
    xml: 'OnlyLabel.label-meta.xml',
  },
  new VirtualTreeContainer([
    {
      dirPath: '',
      children: [
        {
          name: 'OnlyLabel.label-meta.xml',
          data: Buffer.from(ONLY_LABEL_CONTENTS),
        },
      ],
    },
  ])
);

export const OTHER_LABEL_CMP = new SourceComponent(
  {
    name: 'OtherLabel',
    type: customLabelType,
    xml: join('labels', 'OtherLabel.label-meta.xml'),
  },
  new VirtualTreeContainer([
    {
      dirPath: 'labels',
      children: [
        {
          name: 'OtherLabel.label-meta.xml',
          data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<CustomLabel xmlns="http://soap.sforce.com/2006/04/metadata">
  <fullName>OtherLabel</fullName>
  <language>en_US</language>
  <protected>true</protected>
  <shortDescription>OtherLabel</shortDescription>
  <value>OtherLabel</value>
</CustomLabel>`),
        },
      ],
    },
  ])
);
