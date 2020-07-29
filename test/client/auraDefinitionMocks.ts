/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { QueryResult } from '../../src/client/types';

export const auraComponent: QueryResult = {
  size: 8,
  totalSize: 8,
  done: true,
  queryLocator: null,
  entityTypeName: 'AuraDefinition',
  records: [
    {
      Id: '0Adxx000001YuCPOP1',
      AuraDefinitionBundle: {
        ApiVersion: '48',
        DeveloperName: 'myTestComponent',
        NamespacePrefix: '',
      },
      DefType: 'COMPONENT',
      Source: "<aura:component>\n    //that's what's up\n</aura:component>",
    },
    {
      Id: '0Adxx000001YuCPOP2',
      AuraDefinitionBundle: {
        ApiVersion: '48',
        DeveloperName: 'myTestComponent',
        NamespacePrefix: '',
      },
      DefType: 'CONTROLLER',
      Source: '({\n    myAction : function(component, event, helper) {\n\n    }\n})',
    },
    {
      Id: '0Adxx000001YuCPOP3',
      AuraDefinitionBundle: {
        ApiVersion: '48',
        DeveloperName: 'myTestComponent',
        NamespacePrefix: '',
      },
      DefType: 'DOCUMENTATION',
      Source:
        '<aura:documentation>\n\t<aura:description>Documentation</aura:description>\n\t<aura:example name="ExampleName" ref="exampleComponentName" label="Label">\n\t\tExample Description\n\t</aura:example>\n</aura:documentation>',
    },
    {
      Id: '0Adxx000001YuCPOP4',
      AuraDefinitionBundle: {
        ApiVersion: '48',
        DeveloperName: 'myTestComponent',
        NamespacePrefix: '',
      },
      DefType: 'RENDERER',
      Source: '({\n\n// Your renderer method overrides go here\n\n})',
    },
    {
      Id: '0Adxx000001YuCPOP5',
      AuraDefinitionBundle: {
        ApiVersion: '48',
        DeveloperName: 'myTestComponent',
        NamespacePrefix: '',
      },
      DefType: 'DESIGN',
      Source: '<design:component >\n\n</design:component>',
    },
    {
      Id: '0Adxx000001YuCPOP6',
      AuraDefinitionBundle: {
        ApiVersion: '48',
        DeveloperName: 'myTestComponent',
        NamespacePrefix: '',
      },
      DefType: 'SVG',
      Source:
        '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<svg width="120px" height="120px" viewBox="0 0 120 120" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">\n\t<g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">\n\t\t<path d="M120,108 C120,114.6 114.6,120 108,120 L12,120 C5.4,120 0,114.6 0,108 L0,12 C0,5.4 5.4,0 12,0 L108,0 C114.6,0 120,5.4 120,12 L120,108 L120,108 Z" id="Shape" fill="#2A739E"/>\n\t\t<path d="M77.7383308,20 L61.1640113,20 L44.7300055,63.2000173 L56.0543288,63.2000173 L40,99.623291 L72.7458388,54.5871812 L60.907727,54.5871812 L77.7383308,20 Z" id="Path-1" fill="#FFFFFF"/>\n\t</g>\n</svg>',
    },
    {
      Id: '0Adxx000001YuCPOP7',
      AuraDefinitionBundle: {
        ApiVersion: '48',
        DeveloperName: 'myTestComponent',
        NamespacePrefix: '',
      },
      DefType: 'HELPER',
      Source: '({\n    helperMethod : function() {\n\n    }\n})',
    },
    {
      Id: '0Adxx000001YuCPOP8',
      AuraDefinitionBundle: {
        ApiVersion: '48',
        DeveloperName: 'myTestComponent',
        NamespacePrefix: '',
      },
      DefType: 'STYLE',
      Source: '.THIS {\n}',
    },
  ],
};

export const auraApplication: QueryResult = {
  size: 1,
  totalSize: 1,
  done: true,
  queryLocator: null,
  entityTypeName: 'AuraDefinition',
  records: [
    {
      Id: '0Adxx00000xxuCPOP5',
      AuraDefinitionBundle: {
        ApiVersion: '35',
        DeveloperName: 'myTestApp',
        NamespacePrefix: '',
      },
      DefType: 'APPLICATION',
      Source: '<aura:application>\n\n</aura:application>',
    },
  ],
};

export const auraEvent: QueryResult = {
  size: 1,
  totalSize: 1,
  done: true,
  queryLocator: null,
  entityTypeName: 'AuraDefinition',
  records: [
    {
      Id: '0Adxx00000xxuCPOP3',
      AuraDefinitionBundle: {
        ApiVersion: '43',
        DeveloperName: 'testEvent',
        NamespacePrefix: '',
      },
      DefType: 'EVENT',
      Source: '<aura:event type="APPLICATION" description="Event template"/>',
    },
  ],
};

export const auraInterface: QueryResult = {
  size: 1,
  totalSize: 1,
  done: true,
  queryLocator: null,
  entityTypeName: 'AuraDefinition',
  records: [
    {
      Id: '0Adxx00000xxuCPOP1',
      AuraDefinitionBundle: {
        ApiVersion: '46',
        DeveloperName: 'testInterface',
        NamespacePrefix: '',
      },
      DefType: 'INTERFACE',
      Source:
        '<aura:interface description="Interface template">\n    <aura:attribute name="example" type="String" default="" description="An example attribute."/>\n</aura:interface>',
    },
  ],
};

export const auraTokens: QueryResult = {
  size: 1,
  totalSize: 1,
  done: true,
  queryLocator: null,
  entityTypeName: 'AuraDefinition',
  records: [
    {
      Id: '0Adxx000001YuCPOP9',
      AuraDefinitionBundle: {
        ApiVersion: '46',
        DeveloperName: 'testAuraTokens',
        NamespacePrefix: '',
      },
      DefType: 'TOKENS',
      Source: '<aura:tokens>\n\t\n</aura:tokens>',
    },
  ],
};
