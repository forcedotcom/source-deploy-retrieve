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
import { SourceComponent, VirtualTreeContainer, presetMap, RegistryAccess } from '../../../src';
import { getEffectiveRegistry } from '../../../src/registry/variants';

// Constants for a matching content file type
export const regAcc = new RegistryAccess(
  getEffectiveRegistry({ presets: [presetMap.get('decomposePermissionSetBeta2')!] })
);

const permissionSet = regAcc.getTypeByName('PermissionSet');

const MDAPI_XML_NAME = 'myPS.permissionset';
const SOURCE_XML_NAME = 'myPS.permissionset-meta.xml';

export const MD_FORMAT_PS = new SourceComponent(
  {
    name: 'myPS',
    type: permissionSet,
    xml: join('permissionsets', MDAPI_XML_NAME),
  },
  new VirtualTreeContainer([
    {
      dirPath: 'permissionsets',
      children: [
        {
          name: MDAPI_XML_NAME,
          data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
    <classAccesses>
        <apexClass>FileUtilities</apexClass>
        <enabled>true</enabled>
    </classAccesses>
    <classAccesses>
        <apexClass>FileUtilitiesTest</apexClass>
        <enabled>true</enabled>
    </classAccesses>
    <classAccesses>
        <apexClass>GeocodingService</apexClass>
        <enabled>true</enabled>
    </classAccesses>
    <classAccesses>
        <apexClass>GeocodingServiceTest</apexClass>
        <enabled>true</enabled>
    </classAccesses>
    <classAccesses>
        <apexClass>PagedResult</apexClass>
        <enabled>true</enabled>
    </classAccesses>
    <classAccesses>
        <apexClass>PropertyController</apexClass>
        <enabled>true</enabled>
    </classAccesses>
    <classAccesses>
        <apexClass>SampleDataController</apexClass>
        <enabled>true</enabled>
    </classAccesses>
    <classAccesses>
        <apexClass>TestPropertyController</apexClass>
        <enabled>true</enabled>
    </classAccesses>
    <classAccesses>
        <apexClass>TestSampleDataController</apexClass>
        <enabled>true</enabled>
    </classAccesses>
    <userPermissions>
        <enabled>true</enabled>
        <name>CanApproveFeedPost</name>
    </userPermissions>
    <userPermissions>
        <enabled>true</enabled>
        <name>PrivacyDataAccess</name>
    </userPermissions>
    <userPermissions>
        <enabled>true</enabled>
        <name>RunFlow</name>
    </userPermissions>
    <userPermissions>
        <enabled>true</enabled>
        <name>ViewRoles</name>
    </userPermissions>
    <userPermissions>
        <enabled>true</enabled>
        <name>ViewSetup</name>
    </userPermissions>
    <objectPermissions>
        <allowCreate>false</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>false</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Account</object>
        <viewAllRecords>true</viewAllRecords>
    </objectPermissions>
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>AppAnalyticsQueryRequest</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>
    <objectPermissions>
        <allowCreate>false</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>false</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Asset</object>
        <viewAllRecords>true</viewAllRecords>
    </objectPermissions>
    <objectPermissions>
        <allowCreate>false</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>false</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>AssetAction</object>
        <viewAllRecords>true</viewAllRecords>
    </objectPermissions>
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>false</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Broker__c</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Broker__c.Broker_Id__c</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Broker__c.Email__c</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Broker__c.Mobile_Phone__c</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Broker__c.Phone__c</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>false</editable>
        <field>Broker__c.Picture_IMG__c</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Broker__c.Picture__c</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Broker__c.Title__c</field>
        <readable>true</readable>
    </fieldPermissions>
    <tabSettings>
        <tab>Broker__c</tab>
        <visibility>Visible</visibility>
    </tabSettings>
    <tabSettings>
        <tab>standard-AssetAction</tab>
        <visibility>Visible</visibility>
    </tabSettings>
    <description>decomposed desc adfadf</description>
    <hasActivationRequired>false</hasActivationRequired>
    <label>decomposed</label>
    <license>Analytics Cloud Integration User</license>
</PermissionSet>
`),
        },
      ],
    },
  ])
);

export const MD_FORMAT_PS_ONE_CHILD = new SourceComponent(
  {
    name: 'myPS',
    type: permissionSet,
    xml: join('permissionsets', MDAPI_XML_NAME),
  },
  new VirtualTreeContainer([
    {
      dirPath: 'permissionsets',
      children: [
        {
          name: MDAPI_XML_NAME,
          data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" ?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
    <description>This PS has only one object permission</description>
    <hasActivationRequired>true</hasActivationRequired>
    <label>test</label>
    <license>testing</license>
    <objectPermissions>
        <allowCreate>false</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>false</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Case</object>
        <viewAllRecords>true</viewAllRecords>
    </objectPermissions>
</PermissionSet>`),
        },
      ],
    },
  ])
);

export const SOURCE_FORMAT_PS = new SourceComponent(
  {
    name: 'myPS',
    type: permissionSet,
    content: join('main', 'default', 'permissionsets', 'myPS', SOURCE_XML_NAME),
  },
  new VirtualTreeContainer([
    {
      dirPath: join('main', 'default', 'permissionsets', 'myPS'),
      children: [
        {
          name: 'myPS.classAccess-meta.xml',
          data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet>
    <classAccesses>
        <apexClass>FileUtilities</apexClass>
        <enabled>true</enabled>
    </classAccesses>
    <classAccesses>
        <apexClass>FileUtilitiesTest</apexClass>
        <enabled>true</enabled>
    </classAccesses>
    <classAccesses>
        <apexClass>GeocodingService</apexClass>
        <enabled>true</enabled>
    </classAccesses>
    <classAccesses>
        <apexClass>GeocodingServiceTest</apexClass>
        <enabled>true</enabled>
    </classAccesses>
    <classAccesses>
        <apexClass>PagedResult</apexClass>
        <enabled>true</enabled>
    </classAccesses>
    <classAccesses>
        <apexClass>PropertyController</apexClass>
        <enabled>true</enabled>
    </classAccesses>
    <classAccesses>
        <apexClass>SampleDataController</apexClass>
        <enabled>true</enabled>
    </classAccesses>
    <classAccesses>
        <apexClass>TestPropertyController</apexClass>
        <enabled>true</enabled>
    </classAccesses>
    <classAccesses>
        <apexClass>TestSampleDataController</apexClass>
        <enabled>true</enabled>
    </classAccesses>
</PermissionSet>
`),
        },
        {
          name: 'myPS.permissionset-meta.xml',
          data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
    <description>decomposed desc adfadf</description>
    <hasActivationRequired>false</hasActivationRequired>
    <label>decomposed</label>
    <license>Analytics Cloud Integration User</license>
</PermissionSet>`),
        },
      ],
    },
    {
      dirPath: join('main', 'default', 'permissionsets', 'myPS', 'objectSettings'),
      children: [
        {
          name: 'Account.objectSettings-meta.xml',
          data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet>
    <objectPermissions>
        <allowCreate>false</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>false</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Account</object>
        <viewAllRecords>true</viewAllRecords>
    </objectPermissions>
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>AppAnalyticsQueryRequest</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>
    <objectPermissions>
        <allowCreate>false</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>false</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Asset</object>
        <viewAllRecords>true</viewAllRecords>
    </objectPermissions>
    <objectPermissions>
        <allowCreate>false</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>false</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>AssetAction</object>
        <viewAllRecords>true</viewAllRecords>
    </objectPermissions>
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>false</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Broker__c</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>
</PermissionSet>
`),
        },
        {
          name: 'Broker__c.objectSettings-meta.xml',
          data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet>
    <fieldPermissions>
        <editable>true</editable>
        <field>Broker__c.Broker_Id__c</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Broker__c.Email__c</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Broker__c.Mobile_Phone__c</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Broker__c.Phone__c</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>false</editable>
        <field>Broker__c.Picture_IMG__c</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Broker__c.Picture__c</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Broker__c.Title__c</field>
        <readable>true</readable>
    </fieldPermissions>
    <tabSettings>
        <tab>Broker__c</tab>
        <visibility>Visible</visibility>
    </tabSettings>
    <tabSettings>
        <tab>standard-AssetAction</tab>
        <visibility>Visible</visibility>
    </tabSettings>
</PermissionSet>
`),
        },
      ],
    },
  ])
);
export const ONLY_PS_PARENT = new SourceComponent(
  {
    name: 'myPS',
    type: permissionSet,
    xml: join('main', 'default', 'permissionsets', 'myPS', `${MDAPI_XML_NAME}-meta.xml`),
  },
  new VirtualTreeContainer([
    {
      dirPath: 'permissionsets',
      children: [
        {
          name: MDAPI_XML_NAME,
          data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
    <description>decomposed desc adfadf</description>
    <hasActivationRequired>false</hasActivationRequired>
    <label>decomposed</label>
    <license>Analytics Cloud Integration User</license>
</PermissionSet>`),
        },
      ],
    },
  ])
);
