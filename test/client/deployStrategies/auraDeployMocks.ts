/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join, basename } from 'path';
import { AuraDefinition } from '../../../src/utils/deploy';
import { SourceComponent, VirtualTreeContainer } from '../../../src/resolve';
import { registry } from '../../../src';

const bundlePath = join('file', 'path', 'aura', 'mockAuraCmp');
const auraXml = join(bundlePath, 'mockAuraCmp.cmp-meta.xml');
export const auraFiles = [
  join(bundlePath, 'mockAuraCmp.auradoc'),
  join(bundlePath, 'mockAuraCmp.cmp'),
  join(bundlePath, 'mockAuraCmp.css'),
  join(bundlePath, 'mockAuraCmp.design'),
  join(bundlePath, 'mockAuraCmp.svg'),
  join(bundlePath, 'mockAuraCmpController.js'),
  join(bundlePath, 'mockAuraCmpHelper.js'),
  join(bundlePath, 'mockAuraCmpRenderer.js'),
  auraXml,
];

export const auraContents = [
  '<aura:documentation><aura:description>Documentation</aura:description><aura:example name="ExampleName" ref="exampleComponentName" label="Label">Example Description</aura:example></aura:documentation>',
  '<aura:component></aura:component>',
  '.THIS {}',
  '<design:component></design:component>',
  '<?xml version="1.0" encoding="UTF-8" standalone="no"?><svg></svg>',
  '({myAction : function(component, event, helper) {}})',
  '({helperMethod : function() {}})',
  '({})',
];

const tree = new VirtualTreeContainer([
  {
    dirPath: bundlePath,
    children: auraFiles.map((f) => basename(f)),
  },
]);
export const auraComponent = new SourceComponent(
  {
    type: registry.types.auradefinitionbundle,
    name: 'mockAuraCmp',
    content: bundlePath,
    xml: auraXml,
  },
  tree
);

export const testAuraList = [
  {
    DefType: 'COMPONENT',
    FilePath: auraFiles[1],
    Format: 'XML',
    Source: auraContents[1],
    AuraDefinitionBundleId: '1dcxxx000000060',
  },
  {
    DefType: 'DOCUMENTATION',
    FilePath: auraFiles[0],
    Format: 'XML',
    Source: auraContents[0],
    AuraDefinitionBundleId: '1dcxxx000000060',
  },
  {
    DefType: 'STYLE',
    FilePath: auraFiles[2],
    Format: 'CSS',
    Source: auraContents[2],
    AuraDefinitionBundleId: '1dcxxx000000060',
  },
  {
    DefType: 'DESIGN',
    FilePath: auraFiles[3],
    Format: 'XML',
    Source: auraContents[3],
    AuraDefinitionBundleId: '1dcxxx000000060',
  },
  {
    DefType: 'SVG',
    FilePath: auraFiles[4],
    Format: 'SVG',
    Source: auraContents[4],
    AuraDefinitionBundleId: '1dcxxx000000060',
  },
  {
    DefType: 'CONTROLLER',
    FilePath: auraFiles[5],
    Format: 'JS',
    Source: auraContents[5],
    AuraDefinitionBundleId: '1dcxxx000000060',
  },
  {
    DefType: 'HELPER',
    FilePath: auraFiles[6],
    Format: 'JS',
    Source: auraContents[6],
    AuraDefinitionBundleId: '1dcxxx000000060',
  },
  {
    DefType: 'RENDERER',
    FilePath: auraFiles[7],
    Format: 'JS',
    Source: auraContents[7],
    AuraDefinitionBundleId: '1dcxxx000000060',
  },
] as AuraDefinition[];

export const createAuraSuccesses = [
  {
    changed: false,
    created: true,
    deleted: false,
    fileName: join(bundlePath, 'mockAuraCmp.cmp'),
    fullName: 'mockAuraCmp/mockAuraCmp.cmp',
    success: true,
    componentType: 'AuraDefinitionBundle',
  },
  {
    changed: false,
    created: true,
    deleted: false,
    fileName: join(bundlePath, 'mockAuraCmp.auradoc'),
    fullName: 'mockAuraCmp/mockAuraCmp.auradoc',
    success: true,
    componentType: 'AuraDefinitionBundle',
  },
  {
    changed: false,
    created: true,
    deleted: false,
    fileName: join(bundlePath, 'mockAuraCmp.css'),
    fullName: 'mockAuraCmp/mockAuraCmp.css',
    success: true,
    componentType: 'AuraDefinitionBundle',
  },
  {
    changed: false,
    created: true,
    deleted: false,
    fileName: join('file', 'path', 'aura/mockAuraCmp/mockAuraCmp.design'),
    fullName: 'mockAuraCmp/mockAuraCmp.design',
    success: true,
    componentType: 'AuraDefinitionBundle',
  },
  {
    changed: false,
    created: true,
    deleted: false,
    fileName: join(bundlePath, 'mockAuraCmp.svg'),
    fullName: 'mockAuraCmp/mockAuraCmp.svg',
    success: true,
    componentType: 'AuraDefinitionBundle',
  },
  {
    changed: false,
    created: true,
    deleted: false,
    fileName: join(bundlePath, 'mockAuraCmpController.js'),
    fullName: 'mockAuraCmp/mockAuraCmpController.js',
    success: true,
    componentType: 'AuraDefinitionBundle',
  },
  {
    changed: false,
    created: true,
    deleted: false,
    fileName: join(bundlePath, 'mockAuraCmpHelper.js'),
    fullName: 'mockAuraCmp/mockAuraCmpHelper.js',
    success: true,
    componentType: 'AuraDefinitionBundle',
  },
  {
    changed: false,
    created: true,
    deleted: false,
    fileName: join(bundlePath, 'mockAuraCmpRenderer.js'),
    fullName: 'mockAuraCmp/mockAuraCmpRenderer.js',
    success: true,
    componentType: 'AuraDefinitionBundle',
  },
];

export const updateCreateSuccesses = [
  {
    changed: true,
    created: false,
    deleted: false,
    fileName: join('aura', 'mockAuraCmp', 'mockAuraCmp.cmp'),
    fullName: 'mockAuraCmp/mockAuraCmp.cmp',
    success: true,
    componentType: 'AuraDefinitionBundle',
  },
  {
    changed: true,
    created: false,
    deleted: false,
    fileName: join('aura', 'mockAuraCmp', 'mockAuraCmp.css'),
    fullName: 'mockAuraCmp/mockAuraCmp.css',
    success: true,
    componentType: 'AuraDefinitionBundle',
  },
  {
    changed: true,
    created: false,
    deleted: false,
    fileName: join('mockAuraCmp/mockAuraCmp.design'),
    fullName: 'aura/mockAuraCmp/mockAuraCmp.design',
    success: true,
    componentType: 'AuraDefinitionBundle',
  },
  {
    changed: false,
    created: true,
    deleted: false,
    fileName: join('aura', 'mockAuraCmp', 'mockAuraCmp.auradoc'),
    fullName: 'mockAuraCmp/mockAuraCmp.auradoc',
    success: true,
    componentType: 'AuraDefinitionBundle',
  },
  {
    changed: false,
    created: true,
    deleted: false,
    fileName: join('aura', 'mockAuraCmp', 'mockAuraCmp.svg'),
    fullName: 'mockAuraCmp/mockAuraCmp.svg',
    success: true,
    componentType: 'AuraDefinitionBundle',
  },
  {
    changed: false,
    created: true,
    deleted: false,
    fileName: join('aura', 'mockAuraCmp', 'mockAuraCmpController.js'),
    fullName: 'mockAuraCmp/mockAuraCmpController.js',
    success: true,
    componentType: 'AuraDefinitionBundle',
  },
  {
    changed: false,
    created: true,
    deleted: false,
    fileName: join('aura', 'mockAuraCmp', 'mockAuraCmpHelper.js'),
    fullName: 'mockAuraCmp/mockAuraCmpHelper.js',
    success: true,
    componentType: 'AuraDefinitionBundle',
  },
  {
    changed: false,
    created: true,
    deleted: false,
    fileName: join('aura', 'mockAuraCmp', 'mockAuraCmpRenderer.js'),
    fullName: 'mockAuraCmp/mockAuraCmpRenderer.js',
    success: true,
    componentType: 'AuraDefinitionBundle',
  },
];
