/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import { expect } from 'chai';
import { buildQuery, queryToFileMap } from '../../src/client/retrieveUtil';
import { MetadataComponent, QueryResult } from '../../src/types';
import {
  auraComponent,
  auraApplication,
  auraEvent,
  auraInterface,
  auraTokens
} from './auraDefinitionMocks';
import { lwcComponentMock } from './lightningComponentMocks';

describe('Tooling Retrieve Util', () => {
  const classMDComponent: MetadataComponent = {
    type: {
      id: 'apexclass',
      name: 'ApexClass',
      directoryName: 'classes',
      inFolder: false,
      suffix: 'cls'
    },
    fullName: 'myTestClass',
    xml: path.join('file', 'path', 'myTestClass.cls-meta.xml'),
    sources: [path.join('file', 'path', 'myTestClass.cls')]
  };

  const pageMDComponent: MetadataComponent = {
    type: {
      id: 'apexpage',
      name: 'ApexPage',
      directoryName: 'pages',
      inFolder: false,
      suffix: 'page'
    },
    fullName: 'myPage',
    xml: path.join('file', 'path', 'myPage.page-meta.xml'),
    sources: [path.join('file', 'path', 'myPage.page')]
  };

  const auraMDComponent: MetadataComponent = {
    type: {
      id: 'auradefinitionbundle',
      name: 'AuraDefinitionBundle',
      directoryName: 'aura',
      inFolder: false
    },
    fullName: 'testApp',
    xml: path.join('file', 'path', 'testApp.app-meta.xml'),
    sources: [path.join('file', 'path', 'testApp.app')]
  };

  it('should generate correct query to retrieve an ApexClass', () => {
    const queryString = buildQuery(classMDComponent, '');

    expect(queryString).to.equal(
      `Select Id, ApiVersion, Body, Name, NamespacePrefix, Status from ApexClass where Name = 'myTestClass' and NamespacePrefix = ''`
    );
  });

  it('should generate correct query to retrieve an ApexPage', () => {
    const queryString = buildQuery(pageMDComponent, '');

    expect(queryString).to.equal(
      `Select Id, ApiVersion, Name, NamespacePrefix, Markup from ApexPage where Name = 'myPage' and NamespacePrefix = ''`
    );
  });

  it('should generate correct query to retrieve an AuraDefinition', () => {
    const queryString = buildQuery(auraMDComponent, '');
    let expectedQuery =
      'Select Id, AuraDefinitionBundle.ApiVersion, AuraDefinitionBundle.DeveloperName, ';
    expectedQuery += 'AuraDefinitionBundle.NamespacePrefix, DefType, Source ';
    expectedQuery += `from AuraDefinition where AuraDefinitionBundle.DeveloperName = 'testApp' and AuraDefinitionBundle.NamespacePrefix = ''`;
    expect(queryString).to.equal(expectedQuery);
  });

  it('should generate correct query to retrieve an AuraDefinition with namespace', () => {
    const queryString = buildQuery(auraMDComponent, 't3str');
    let expectedQuery =
      'Select Id, AuraDefinitionBundle.ApiVersion, AuraDefinitionBundle.DeveloperName, ';
    expectedQuery += 'AuraDefinitionBundle.NamespacePrefix, DefType, Source ';
    expectedQuery += `from AuraDefinition where AuraDefinitionBundle.DeveloperName = 'testApp' and AuraDefinitionBundle.NamespacePrefix = 't3str'`;
    expect(queryString).to.equal(expectedQuery);
  });

  it('should generate correct file map for ApexClass metadata', () => {
    const apexClassQueryResult: QueryResult = {
      done: true,
      entityTypeName: 'ApexClass',
      records: [
        {
          ApiVersion: '32',
          Body: 'public with sharing class myTestClass {}',
          Id: '01pxxx000000034',
          Name: 'myTestClass',
          NamespacePrefix: null,
          Status: 'Active'
        }
      ],
      size: 1,
      totalSize: 1,
      queryLocator: null
    };
    const resultMap = queryToFileMap(apexClassQueryResult, classMDComponent);
    expect(resultMap.size).to.equal(2);
    expect(resultMap.has(classMDComponent.xml)).to.be.true;
    let expectedMetaXML = '<?xml version="1.0" encoding="UTF-8"?>\n';
    expectedMetaXML += '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">\n';
    expectedMetaXML += '\t<apiVersion>32.0</apiVersion>\n';
    expectedMetaXML += '\t<status>Active</status>\n';
    expectedMetaXML += '</ApexClass>';
    expect(resultMap.get(classMDComponent.xml)).to.equal(expectedMetaXML);
    expect(resultMap.has(classMDComponent.sources[0])).to.be.true;
    expect(resultMap.get(classMDComponent.sources[0])).to.equal(
      'public with sharing class myTestClass {}'
    );
  });

  it('should generate correct file map for ApexPage metadata', () => {
    const apexPageQueryResult: QueryResult = {
      done: true,
      entityTypeName: 'ApexPage',
      records: [
        {
          ApiVersion: '45',
          Markup: '<apex:page>\n<h1>Hello</h1>\n</apex:page>',
          Id: '066xxx000000034',
          Name: 'myPage',
          NamespacePrefix: null
        }
      ],
      size: 1,
      totalSize: 1,
      queryLocator: null
    };
    const resultMap = queryToFileMap(apexPageQueryResult, pageMDComponent);
    expect(resultMap.size).to.equal(2);
    expect(resultMap.has(pageMDComponent.xml)).to.be.true;
    let expectedMetaXML = '<?xml version="1.0" encoding="UTF-8"?>\n';
    expectedMetaXML += '<ApexPage xmlns="http://soap.sforce.com/2006/04/metadata">\n';
    expectedMetaXML += '\t<apiVersion>45.0</apiVersion>\n';
    expectedMetaXML += '</ApexPage>';
    expect(resultMap.get(pageMDComponent.xml)).to.equal(expectedMetaXML);
    expect(resultMap.has(pageMDComponent.sources[0])).to.be.true;
    expect(resultMap.get(pageMDComponent.sources[0])).to.equal(
      '<apex:page>\n<h1>Hello</h1>\n</apex:page>'
    );
  });

  it('should generate correct file map for ApexPage metadata with overrideOutput param', () => {
    const apexPageQueryResult: QueryResult = {
      done: true,
      entityTypeName: 'ApexPage',
      records: [
        {
          ApiVersion: '45',
          Markup: '<apex:page>\n<h1>Hello</h1>\n</apex:page>',
          Id: '066xxx000000034',
          Name: 'myPage',
          NamespacePrefix: null
        }
      ],
      size: 1,
      totalSize: 1,
      queryLocator: null
    };
    const overrideOutputPathMeta = path.join(
      'file',
      'different',
      'path',
      'myTestClass.cls-meta.xml'
    );
    const overrideOutputPath = path.join('file', 'different', 'path', 'myTestClass.cls');
    const resultMap = queryToFileMap(apexPageQueryResult, pageMDComponent, overrideOutputPathMeta);
    expect(resultMap.size).to.equal(2);
    expect(resultMap.has(overrideOutputPathMeta)).to.be.true;
    let expectedMetaXML = '<?xml version="1.0" encoding="UTF-8"?>\n';
    expectedMetaXML += '<ApexPage xmlns="http://soap.sforce.com/2006/04/metadata">\n';
    expectedMetaXML += '\t<apiVersion>45.0</apiVersion>\n';
    expectedMetaXML += '</ApexPage>';
    expect(resultMap.get(overrideOutputPathMeta)).to.equal(expectedMetaXML);
    expect(resultMap.has(overrideOutputPath)).to.be.true;
    expect(resultMap.get(overrideOutputPath)).to.equal('<apex:page>\n<h1>Hello</h1>\n</apex:page>');
  });

  it('should generate correct file map for AuraDefinition component metadata', () => {
    const cmpPath = path.join('file', 'path', 'aura', 'myAuraCmp', 'myAuraCmp.cmp');
    const auraDocPath = path.join('file', 'path', 'aura', 'myAuraCmp', 'myAuraCmp.auradoc');
    const cmpMetaPath = path.join('file', 'path', 'aura', 'myAuraCmp', 'myAuraCmp.cmp-meta.xml');
    const cssPath = path.join('file', 'path', 'aura', 'myAuraCmp', 'myAuraCmp.css');
    const designPath = path.join('file', 'path', 'aura', 'myAuraCmp', 'myAuraCmp.design');
    const svgPath = path.join('file', 'path', 'aura', 'myAuraCmp', 'myAuraCmp.svg');
    const controllerPath = path.join('file', 'path', 'aura', 'myAuraCmp', 'myAuraCmpController.js');
    const helperPath = path.join('file', 'path', 'aura', 'myAuraCmp', 'myAuraCmpHelper.js');
    const rendererPath = path.join('file', 'path', 'aura', 'myAuraCmp', 'myAuraCmpRenderer.js');
    const auraComponentMD: MetadataComponent = {
      type: {
        id: 'auradefinitionbundle',
        name: 'AuraDefinitionBundle',
        directoryName: 'aura',
        inFolder: false
      },
      fullName: 'myAuraCmp',
      xml: cmpMetaPath,
      sources: [
        cmpPath,
        auraDocPath,
        cssPath,
        designPath,
        svgPath,
        controllerPath,
        helperPath,
        rendererPath
      ]
    };

    const resultMap = queryToFileMap(auraComponent, auraComponentMD);
    expect(resultMap.size).to.equal(9);
    expect(resultMap.has(cmpMetaPath)).to.be.true;
    let expectedMetaXML = '<?xml version="1.0" encoding="UTF-8"?>\n';
    expectedMetaXML += '<AuraDefinitionBundle xmlns="http://soap.sforce.com/2006/04/metadata">\n';
    expectedMetaXML += '\t<apiVersion>48.0</apiVersion>\n';
    expectedMetaXML += '</AuraDefinitionBundle>';
    expect(resultMap.get(cmpMetaPath)).to.equal(expectedMetaXML);
    expect(resultMap.has(cmpPath)).to.be.true;
    expect(resultMap.get(cmpPath)).to.equal(
      `<aura:component>\n    //that's what's up\n</aura:component>`
    );
    expect(resultMap.has(auraDocPath)).to.be.true;
    expect(resultMap.get(auraDocPath)).to.equal(
      '<aura:documentation>\n\t<aura:description>Documentation</aura:description>\n\t<aura:example name="ExampleName" ref="exampleComponentName" label="Label">\n\t\tExample Description\n\t</aura:example>\n</aura:documentation>'
    );
    expect(resultMap.has(cssPath)).to.be.true;
    expect(resultMap.get(cssPath)).to.equal('.THIS {\n}');
    expect(resultMap.has(designPath)).to.be.true;
    expect(resultMap.get(designPath)).to.equal('<design:component >\n\n</design:component>');
    expect(resultMap.has(svgPath)).to.be.true;
    expect(resultMap.get(svgPath)).to.equal(
      '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<svg width="120px" height="120px" viewBox="0 0 120 120" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">\n\t<g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">\n\t\t<path d="M120,108 C120,114.6 114.6,120 108,120 L12,120 C5.4,120 0,114.6 0,108 L0,12 C0,5.4 5.4,0 12,0 L108,0 C114.6,0 120,5.4 120,12 L120,108 L120,108 Z" id="Shape" fill="#2A739E"/>\n\t\t<path d="M77.7383308,20 L61.1640113,20 L44.7300055,63.2000173 L56.0543288,63.2000173 L40,99.623291 L72.7458388,54.5871812 L60.907727,54.5871812 L77.7383308,20 Z" id="Path-1" fill="#FFFFFF"/>\n\t</g>\n</svg>'
    );
    expect(resultMap.has(controllerPath)).to.be.true;
    expect(resultMap.get(controllerPath)).to.equal(
      '({\n    myAction : function(component, event, helper) {\n\n    }\n})'
    );
    expect(resultMap.has(helperPath)).to.be.true;
    expect(resultMap.get(helperPath)).to.equal('({\n    helperMethod : function() {\n\n    }\n})');
    expect(resultMap.has(rendererPath)).to.be.true;
    expect(resultMap.get(rendererPath)).to.equal(
      '({\n\n// Your renderer method overrides go here\n\n})'
    );
  });

  it('should generate correct file map for AuraDefinition application metadata', () => {
    const appPath = path.join('file', 'path', 'aura', 'myAuraApp', 'myAuraApp.app');
    const appMetaPath = path.join('file', 'path', 'aura', 'myAuraApp', 'myAuraApp.app-meta.xml');
    const auraApplicationMD: MetadataComponent = {
      type: {
        id: 'auradefinitionbundle',
        name: 'AuraDefinitionBundle',
        directoryName: 'aura',
        inFolder: false
      },
      fullName: 'myAuraApp',
      xml: appMetaPath,
      sources: [appPath]
    };

    const resultMap = queryToFileMap(auraApplication, auraApplicationMD);
    expect(resultMap.size).to.equal(2);
    expect(resultMap.has(appMetaPath)).to.be.true;
    let expectedMetaXML = '<?xml version="1.0" encoding="UTF-8"?>\n';
    expectedMetaXML += '<AuraDefinitionBundle xmlns="http://soap.sforce.com/2006/04/metadata">\n';
    expectedMetaXML += '\t<apiVersion>35.0</apiVersion>\n';
    expectedMetaXML += '</AuraDefinitionBundle>';
    expect(resultMap.get(appMetaPath)).to.equal(expectedMetaXML);
    expect(resultMap.has(appPath)).to.be.true;
    expect(resultMap.get(appPath)).to.equal('<aura:application>\n\n</aura:application>');
  });

  it('should generate correct file map for AuraDefinition event metadata', () => {
    const eventPath = path.join('file', 'path', 'aura', 'myAuraEvent', 'myAuraEvent.evt');
    const eventMetaPath = path.join(
      'file',
      'path',
      'aura',
      'myAuraEvent',
      'myAuraEvent.evt-meta.xml'
    );
    const auraEventMD: MetadataComponent = {
      type: {
        id: 'auradefinitionbundle',
        name: 'AuraDefinitionBundle',
        directoryName: 'aura',
        inFolder: false
      },
      fullName: 'myAuraEvent',
      xml: eventMetaPath,
      sources: [eventPath]
    };

    const resultMap = queryToFileMap(auraEvent, auraEventMD);
    expect(resultMap.size).to.equal(2);
    expect(resultMap.has(eventMetaPath)).to.be.true;
    let expectedMetaXML = '<?xml version="1.0" encoding="UTF-8"?>\n';
    expectedMetaXML += '<AuraDefinitionBundle xmlns="http://soap.sforce.com/2006/04/metadata">\n';
    expectedMetaXML += '\t<apiVersion>43.0</apiVersion>\n';
    expectedMetaXML += '</AuraDefinitionBundle>';
    expect(resultMap.get(eventMetaPath)).to.equal(expectedMetaXML);
    expect(resultMap.has(eventPath)).to.be.true;
    expect(resultMap.get(eventPath)).to.equal(
      '<aura:event type="APPLICATION" description="Event template"/>'
    );
  });

  it('should generate correct file map for AuraDefinition interface metadata', () => {
    const interfacePath = path.join(
      'file',
      'path',
      'aura',
      'myAuraInterface',
      'myAuraInterface.intf'
    );
    const interfaceMetaPath = path.join(
      'file',
      'path',
      'aura',
      'myAuraInterface',
      'myAuraInterface.intf-meta.xml'
    );
    const auraInterfaceMD: MetadataComponent = {
      type: {
        id: 'auradefinitionbundle',
        name: 'AuraDefinitionBundle',
        directoryName: 'aura',
        inFolder: false
      },
      fullName: 'myAuraInterface',
      xml: interfaceMetaPath,
      sources: [interfacePath]
    };

    const resultMap = queryToFileMap(auraInterface, auraInterfaceMD);
    expect(resultMap.size).to.equal(2);
    expect(resultMap.has(interfaceMetaPath)).to.be.true;
    let expectedMetaXML = '<?xml version="1.0" encoding="UTF-8"?>\n';
    expectedMetaXML += '<AuraDefinitionBundle xmlns="http://soap.sforce.com/2006/04/metadata">\n';
    expectedMetaXML += '\t<apiVersion>46.0</apiVersion>\n';
    expectedMetaXML += '</AuraDefinitionBundle>';
    expect(resultMap.get(interfaceMetaPath)).to.equal(expectedMetaXML);
    expect(resultMap.has(interfacePath)).to.be.true;
    expect(resultMap.get(interfacePath)).to.equal(
      '<aura:interface description="Interface template">\n    <aura:attribute name="example" type="String" default="" description="An example attribute."/>\n</aura:interface>'
    );
  });

  it('should generate correct file map for AuraDefinition tokens metadata', () => {
    const tokensPath = path.join('file', 'path', 'aura', 'myAuraToken', 'myAuraToken.tokens');
    const tokensMetaPath = path.join(
      'file',
      'path',
      'aura',
      'myAuraToken',
      'myAuraToken.tokens-meta.xml'
    );
    const auraTokenMD: MetadataComponent = {
      type: {
        id: 'auradefinitionbundle',
        name: 'AuraDefinitionBundle',
        directoryName: 'aura',
        inFolder: false
      },
      fullName: 'myAuraToken',
      xml: tokensMetaPath,
      sources: [tokensPath]
    };

    const resultMap = queryToFileMap(auraTokens, auraTokenMD);
    expect(resultMap.size).to.equal(2);
    expect(resultMap.has(tokensMetaPath)).to.be.true;
    let expectedMetaXML = '<?xml version="1.0" encoding="UTF-8"?>\n';
    expectedMetaXML += '<AuraDefinitionBundle xmlns="http://soap.sforce.com/2006/04/metadata">\n';
    expectedMetaXML += '\t<apiVersion>46.0</apiVersion>\n';
    expectedMetaXML += '</AuraDefinitionBundle>';
    expect(resultMap.get(tokensMetaPath)).to.equal(expectedMetaXML);
    expect(resultMap.has(tokensPath)).to.be.true;
    expect(resultMap.get(tokensPath)).to.equal('<aura:tokens>\n\t\n</aura:tokens>');
  });

  it('should generate correct file map for LightningComponentBundle metadata', () => {
    const htmlPath = path.join('file', 'path', 'lwc', 'myLWCComponent', 'myLWCComponent.html');
    const jsPath = path.join('file', 'path', 'lwc', 'myLWCComponent', 'myLWCComponent.js');
    const cssPath = path.join('file', 'path', 'lwc', 'myLWCComponent', 'myLWCComponent.css');
    const metaPath = path.join(
      'file',
      'path',
      'lwc',
      'myLWCComponent',
      'myLWCComponent.js-meta.xml'
    );
    const lwcMD: MetadataComponent = {
      type: {
        id: 'lightningcomponentbundle',
        name: 'LightningComponentBundle',
        directoryName: 'lwc',
        inFolder: false
      },
      fullName: 'myLWCComponent',
      xml: metaPath,
      sources: [htmlPath, jsPath, cssPath]
    };

    const resultMap = queryToFileMap(lwcComponentMock, lwcMD);
    expect(resultMap.size).to.equal(4);
    expect(resultMap.has(htmlPath)).to.be.true;
    expect(resultMap.get(htmlPath)).to.equal('<template>\n    \n</template>');
    expect(resultMap.has(jsPath)).to.be.true;
    expect(resultMap.get(jsPath)).to.equal(
      "import { LightningElement } from 'lwc';\n\nexport default class myLWCComponent extends LightningElement {}"
    );
    expect(resultMap.has(cssPath)).to.be.true;
    expect(resultMap.get(cssPath)).to.equal(
      ':host {\n    position: relative;\n    display: block;\n}\n\nimg,\nvideo {\n    position: relative;\n    width: 100%;\n}'
    );
    expect(resultMap.has(metaPath)).to.be.true;
    expect(resultMap.get(metaPath)).to.equal(
      '<?xml version="1.0" encoding="UTF-8" ?>\n<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">\n    <apiVersion>46.0</apiVersion>\n</LightningComponentBundle>'
    );
  });
});
