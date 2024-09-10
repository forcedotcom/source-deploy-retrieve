/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'node:path';
import { SourceComponent, VirtualTreeContainer, presetMap, RegistryAccess } from '../../../src';
import { getEffectiveRegistry } from '../../../src/registry/variants';

// Constants for a matching content file type
const regAcc = new RegistryAccess(getEffectiveRegistry({ presets: [presetMap.get('decomposePermissionSetBeta2')!] }));

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

// export const THREE_CUSTOM_LABELS_CMP = new SourceComponent(
//   {
//     name: 'CustomLabels',
//     type: permissionSet,
//     xml: join('labels', MDAPI_XML_NAME),
//   },
//   new VirtualTreeContainer([
//     {
//       dirPath: 'permissionSet',
//       children: [
//         {
//           name: MDAPI_XML_NAME,
//           data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
// <CustomLabels xmlns="http://soap.sforce.com/2006/04/metadata">
//     <labels>
//         <fullName>DeleteMe</fullName>
//         <language>en_US</language>
//         <protected>true</protected>
//         <shortDescription>DeleteMe</shortDescription>
//         <value>Test</value>
//     </labels>
//     <labels>
//         <fullName>KeepMe1</fullName>
//         <language>en_US</language>
//         <protected>true</protected>
//         <shortDescription>KeepMe1</shortDescription>
//         <value>Test</value>
//     </labels>
//     <labels>
//         <fullName>KeepMe2</fullName>
//         <language>en_US</language>
//         <protected>true</protected>
//         <shortDescription>KeepMe2</shortDescription>
//         <value>Test</value>
//     </labels>
// </CustomLabels>`),
//         },
//       ],
//     },
//   ])
// );
//
// const ONLY_LABEL_CONTENTS = `<?xml version="1.0" encoding="UTF-8"?>
// <CustomLabel xmlns="http://soap.sforce.com/2006/04/metadata">
//   <fullName>OnlyLabel</fullName>
//   <language>en_US</language>
//   <protected>true</protected>
//   <shortDescription>OnlyLabel</shortDescription>
//   <value>OnlyLabel</value>
// </CustomLabel>`;
//
// export const ONLY_LABEL_CMP_IN_DEFAULT_DIR_CMP = new SourceComponent(
//   {
//     name: 'OnlyLabel',
//     type: customLabelType,
//     xml: join('main', 'default', 'labels', 'OnlyLabel.label-meta.xml'),
//   },
//   new VirtualTreeContainer([
//     {
//       dirPath: join('main', 'default', 'labels'),
//       children: [
//         {
//           name: 'OnlyLabel.label-meta.xml',
//           data: Buffer.from(ONLY_LABEL_CONTENTS),
//         },
//       ],
//     },
//   ])
// );
//
// export const ONLY_LABEL_CMP_IN_ANOTHER_DIR_CMP = new SourceComponent(
//   {
//     name: 'OnlyLabel',
//     type: customLabelType,
//     xml: join('other', 'dir', 'labels', 'OnlyLabel.label-meta.xml'),
//   },
//   new VirtualTreeContainer([
//     {
//       dirPath: join('other', 'dir', 'labels'),
//       children: [
//         {
//           name: 'OnlyLabel.label-meta.xml',
//           data: Buffer.from(ONLY_LABEL_CONTENTS),
//         },
//       ],
//     },
//   ])
// );
//
// export const ONLY_LABEL_NO_DIR_CMP = new SourceComponent(
//   {
//     name: 'OnlyLabel',
//     type: customLabelType,
//     xml: 'OnlyLabel.label-meta.xml',
//   },
//   new VirtualTreeContainer([
//     {
//       dirPath: '',
//       children: [
//         {
//           name: 'OnlyLabel.label-meta.xml',
//           data: Buffer.from(ONLY_LABEL_CONTENTS),
//         },
//       ],
//     },
//   ])
// );
//
// export const OTHER_LABEL_CMP = new SourceComponent(
//   {
//     name: 'OtherLabel',
//     type: customLabelType,
//     xml: join('labels', 'OtherLabel.label-meta.xml'),
//   },
//   new VirtualTreeContainer([
//     {
//       dirPath: 'permissionSet',
//       children: [
//         {
//           name: 'OtherLabel.label-meta.xml',
//           data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
// <CustomLabel xmlns="http://soap.sforce.com/2006/04/metadata">
//   <fullName>OtherLabel</fullName>
//   <language>en_US</language>
//   <protected>true</protected>
//   <shortDescription>OtherLabel</shortDescription>
//   <value>OtherLabel</value>
// </CustomLabel>`),
//         },
//       ],
//     },
//   ])
// );
