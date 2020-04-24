/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'path';
import { AuraDefinition } from '../../../src/utils/deploy';

export const auraFiles = [
  join('file', 'path', 'aura', 'mockAuraCmp', 'mockAuraCmp.auradoc'),
  join('file', 'path', 'aura', 'mockAuraCmp', 'mockAuraCmp.cmp'),
  join('file', 'path', 'aura', 'mockAuraCmp', 'mockAuraCmp.css'),
  join('file', 'path', 'aura', 'mockAuraCmp', 'mockAuraCmp.design'),
  join('file', 'path', 'aura', 'mockAuraCmp', 'mockAuraCmp.svg'),
  join('file', 'path', 'aura', 'mockAuraCmp', 'mockAuraCmpController.js'),
  join('file', 'path', 'aura', 'mockAuraCmp', 'mockAuraCmpHelper.js'),
  join('file', 'path', 'aura', 'mockAuraCmp', 'mockAuraCmpRenderer.js')
];

export const auraContents = [
  '<aura:documentation><aura:description>Documentation</aura:description><aura:example name="ExampleName" ref="exampleComponentName" label="Label">Example Description</aura:example></aura:documentation>',
  '<aura:component></aura:component>',
  '.THIS {}',
  '<design:component></design:component>',
  '<?xml version="1.0" encoding="UTF-8" standalone="no"?><svg></svg>',
  '({myAction : function(component, event, helper) {}})',
  '({helperMethod : function() {}})',
  '({})'
];

export const auraComponent = {
  type: {
    name: 'AuraDefinitionBundle',
    directoryName: 'aura',
    inFolder: false
  },
  fullName: 'mockAuraCmp',
  sources: auraFiles,
  xml: join('file', 'path', 'aura', 'mockAuraCmp', 'mockAuraCmp.cmp-meta.xml')
};

export const testAuraList = [
  {
    DefType: 'COMPONENT',
    FilePath: auraFiles[1],
    Format: 'XML',
    Source: auraContents[1]
  },
  {
    DefType: 'DOCUMENTATION',
    FilePath: auraFiles[0],
    Format: 'XML',
    Source: auraContents[0]
  },
  {
    DefType: 'STYLE',
    FilePath: auraFiles[2],
    Format: 'CSS',
    Source: auraContents[2]
  },
  {
    DefType: 'DESIGN',
    FilePath: auraFiles[3],
    Format: 'XML',
    Source: auraContents[3]
  },
  {
    DefType: 'SVG',
    FilePath: auraFiles[4],
    Format: 'XML',
    Source: auraContents[4]
  },
  {
    DefType: 'CONTROLLER',
    FilePath: auraFiles[5],
    Format: 'JS',
    Source: auraContents[5]
  },
  {
    DefType: 'HELPER',
    FilePath: auraFiles[6],
    Format: 'JS',
    Source: auraContents[6]
  },
  {
    DefType: 'RENDERER',
    FilePath: auraFiles[7],
    Format: 'JS',
    Source: auraContents[7]
  }
] as AuraDefinition[];

export const createAuraSuccesses = [
  {
    changed: false,
    created: true,
    deleted: false,
    fileName: join('aura', 'mockAuraCmp', 'mockAuraCmp.cmp'),
    fullName: join('mockAuraCmp', 'mockAuraCmp.cmp'),
    success: true,
    componentType: 'AuraDefinitionBundle'
  },
  {
    changed: false,
    created: true,
    deleted: false,
    fileName: join('aura', 'mockAuraCmp', 'mockAuraCmp.auradoc'),
    fullName: join('mockAuraCmp', 'mockAuraCmp.auradoc'),
    success: true,
    componentType: 'AuraDefinitionBundle'
  },
  {
    changed: false,
    created: true,
    deleted: false,
    fileName: join('aura', 'mockAuraCmp', 'mockAuraCmp.css'),
    fullName: join('mockAuraCmp', 'mockAuraCmp.css'),
    success: true,
    componentType: 'AuraDefinitionBundle'
  },
  {
    changed: false,
    created: true,
    deleted: false,
    fileName: join('aura/mockAuraCmp/mockAuraCmp.design'),
    fullName: join('mockAuraCmp', 'mockAuraCmp.design'),
    success: true,
    componentType: 'AuraDefinitionBundle'
  },
  {
    changed: false,
    created: true,
    deleted: false,
    fileName: join('aura', 'mockAuraCmp', 'mockAuraCmp.svg'),
    fullName: join('mockAuraCmp', 'mockAuraCmp.svg'),
    success: true,
    componentType: 'AuraDefinitionBundle'
  },
  {
    changed: false,
    created: true,
    deleted: false,
    fileName: join('aura', 'mockAuraCmp', 'mockAuraCmpController.js'),
    fullName: join('mockAuraCmp', 'mockAuraCmpController.js'),
    success: true,
    componentType: 'AuraDefinitionBundle'
  },
  {
    changed: false,
    created: true,
    deleted: false,
    fileName: join('aura', 'mockAuraCmp', 'mockAuraCmpHelper.js'),
    fullName: join('mockAuraCmp', 'mockAuraCmpHelper.js'),
    success: true,
    componentType: 'AuraDefinitionBundle'
  },
  {
    changed: false,
    created: true,
    deleted: false,
    fileName: join('aura', 'mockAuraCmp', 'mockAuraCmpRenderer.js'),
    fullName: join('mockAuraCmp', 'mockAuraCmpRenderer.js'),
    success: true,
    componentType: 'AuraDefinitionBundle'
  }
];

export const updateCreateSuccesses = [
  {
    changed: true,
    created: false,
    deleted: false,
    fileName: join('aura', 'mockAuraCmp', 'mockAuraCmp.cmp'),
    fullName: join('mockAuraCmp', 'mockAuraCmp.cmp'),
    success: true,
    componentType: 'AuraDefinitionBundle'
  },
  {
    changed: true,
    created: false,
    deleted: false,
    fileName: join('aura', 'mockAuraCmp', 'mockAuraCmp.css'),
    fullName: join('mockAuraCmp', 'mockAuraCmp.css'),
    success: true,
    componentType: 'AuraDefinitionBundle'
  },
  {
    changed: true,
    created: false,
    deleted: false,
    fileName: join('mockAuraCmp/mockAuraCmp.design'),
    fullName: join('aura', 'mockAuraCmp', 'mockAuraCmp.design'),
    success: true,
    componentType: 'AuraDefinitionBundle'
  },
  {
    changed: false,
    created: true,
    deleted: false,
    fileName: join('aura', 'mockAuraCmp', 'mockAuraCmp.auradoc'),
    fullName: join('mockAuraCmp', 'mockAuraCmp.auradoc'),
    success: true,
    componentType: 'AuraDefinitionBundle'
  },
  {
    changed: false,
    created: true,
    deleted: false,
    fileName: join('aura', 'mockAuraCmp', 'mockAuraCmp.svg'),
    fullName: join('mockAuraCmp', 'mockAuraCmp.svg'),
    success: true,
    componentType: 'AuraDefinitionBundle'
  },
  {
    changed: false,
    created: true,
    deleted: false,
    fileName: join('aura', 'mockAuraCmp', 'mockAuraCmpController.js'),
    fullName: join('mockAuraCmp', 'mockAuraCmpController.js'),
    success: true,
    componentType: 'AuraDefinitionBundle'
  },
  {
    changed: false,
    created: true,
    deleted: false,
    fileName: join('aura', 'mockAuraCmp', 'mockAuraCmpHelper.js'),
    fullName: join('mockAuraCmp', 'mockAuraCmpHelper.js'),
    success: true,
    componentType: 'AuraDefinitionBundle'
  },
  {
    changed: false,
    created: true,
    deleted: false,
    fileName: join('aura', 'mockAuraCmp', 'mockAuraCmpRenderer.js'),
    fullName: join('mockAuraCmp', 'mockAuraCmpRenderer.js'),
    success: true,
    componentType: 'AuraDefinitionBundle'
  }
];
