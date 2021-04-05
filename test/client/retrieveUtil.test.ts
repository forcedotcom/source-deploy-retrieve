/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import { expect } from 'chai';
import { buildQuery, queryToFileMap } from '../../src/client/retrieveUtil';
import { QueryResult } from '../../src/client/types';
import {
  auraComponent,
  auraApplication,
  auraEvent,
  auraInterface,
  auraTokens,
} from './auraDefinitionMocks';
import { lwcComponentMock } from './lightningComponentMocks';
import { SourceComponent, VirtualTreeContainer } from '../../src/resolve';
import { registry } from '../../src';

describe('Tooling Retrieve Util', () => {
  const rootPath = path.join('file', 'path');
  const classMDComponent: SourceComponent = SourceComponent.createVirtualComponent(
    {
      type: registry.types.apexclass,
      name: 'myTestClass',
      xml: path.join(rootPath, 'myTestClass.cls-meta.xml'),
      content: path.join(rootPath, 'myTestClass.cls'),
    },
    [
      {
        dirPath: rootPath,
        children: ['myTestClass.cls-meta.xml', 'myTestClass.cls'],
      },
    ]
  );
  const pageMDComponent: SourceComponent = SourceComponent.createVirtualComponent(
    {
      type: registry.types.apexpage,
      name: 'myPage',
      xml: path.join(rootPath, 'myPage.page-meta.xml'),
      content: path.join(rootPath, 'myPage.page'),
    },
    [
      {
        dirPath: rootPath,
        children: ['myPage.page', 'myPage.page-meta.xml'],
      },
    ]
  );
  const auraMDComponent: SourceComponent = SourceComponent.createVirtualComponent(
    {
      type: registry.types.auradefinitionbundle,
      name: 'testApp',
      xml: path.join(rootPath, 'testApp.app-meta.xml'),
      content: path.join(rootPath, 'testApp.app'),
    },
    [
      {
        dirPath: rootPath,
        children: ['testApp.app', 'testApp.app-meta.xml'],
      },
    ]
  );

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
          Status: 'Active',
        },
      ],
      size: 1,
      totalSize: 1,
      queryLocator: null,
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
    expect(resultMap.has(classMDComponent.content)).to.be.true;
    expect(resultMap.get(classMDComponent.content)).to.equal(
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
          NamespacePrefix: null,
        },
      ],
      size: 1,
      totalSize: 1,
      queryLocator: null,
    };
    const resultMap = queryToFileMap(apexPageQueryResult, pageMDComponent);
    expect(resultMap.size).to.equal(2);
    expect(resultMap.has(pageMDComponent.xml)).to.be.true;
    let expectedMetaXML = '<?xml version="1.0" encoding="UTF-8"?>\n';
    expectedMetaXML += '<ApexPage xmlns="http://soap.sforce.com/2006/04/metadata">\n';
    expectedMetaXML += '\t<apiVersion>45.0</apiVersion>\n';
    expectedMetaXML += '</ApexPage>';
    expect(resultMap.get(pageMDComponent.xml)).to.equal(expectedMetaXML);
    expect(resultMap.has(pageMDComponent.content)).to.be.true;
    expect(resultMap.get(pageMDComponent.content)).to.equal(
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
          NamespacePrefix: null,
        },
      ],
      size: 1,
      totalSize: 1,
      queryLocator: null,
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
    const bundlePath = path.join('file', 'path', 'aura', 'myAuraCmp');
    const cmpPath = path.join(bundlePath, 'myAuraCmp.cmp');
    const auraDocPath = path.join(bundlePath, 'myAuraCmp.auradoc');
    const cmpMetaPath = path.join(bundlePath, 'myAuraCmp.cmp-meta.xml');
    const cssPath = path.join(bundlePath, 'myAuraCmp.css');
    const designPath = path.join(bundlePath, 'myAuraCmp.design');
    const svgPath = path.join(bundlePath, 'myAuraCmp.svg');
    const controllerPath = path.join(bundlePath, 'myAuraCmpController.js');
    const helperPath = path.join(bundlePath, 'myAuraCmpHelper.js');
    const rendererPath = path.join(bundlePath, 'myAuraCmpRenderer.js');
    const auraComponentMD = SourceComponent.createVirtualComponent(
      {
        type: registry.types.auradefinitionbundle,
        name: 'myAuraCmp',
        xml: cmpMetaPath,
        content: bundlePath,
      },
      [
        {
          dirPath: bundlePath,
          children: [
            'myAuraCmp.cmp',
            'myAuraCmp.auradoc',
            'myAuraCmp.cmp-meta.xml',
            'myAuraCmp.css',
            'myAuraCmp.design',
            'myAuraCmp.svg',
            'myAuraCmpController.js',
            'myAuraCmpHelper.js',
            'myAuraCmpRenderer.js',
          ],
        },
      ]
    );

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
    const bundlePath = path.join('file', 'path', 'aura', 'myAuraApp');
    const appPath = path.join(bundlePath, 'myAuraApp.app');
    const appMetaPath = path.join(bundlePath, 'myAuraApp.app-meta.xml');
    const tree = new VirtualTreeContainer([
      {
        dirPath: bundlePath,
        children: [path.basename(appPath), path.basename(appMetaPath)],
      },
    ]);
    const auraApplicationMD: SourceComponent = new SourceComponent(
      {
        type: registry.types.auradefinitionbundle,
        name: 'myAuraApp',
        xml: appMetaPath,
        content: bundlePath,
      },
      tree
    );

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
    const bundlePath = path.join('file', 'path', 'aura', 'myAuraEvent');
    const eventPath = path.join(bundlePath, 'myAuraEvent.evt');
    const eventMetaPath = path.join(bundlePath, 'myAuraEvent.evt-meta.xml');
    const tree = new VirtualTreeContainer([
      {
        dirPath: bundlePath,
        children: [path.basename(eventPath), path.basename(eventMetaPath)],
      },
    ]);
    const auraEventMD: SourceComponent = new SourceComponent(
      {
        type: registry.types.auradefinitionbundle,
        name: 'myAuraEvent',
        xml: eventMetaPath,
        content: bundlePath,
      },
      tree
    );

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
    const bundlePath = path.join('file', 'path', 'aura', 'myAuraInterface');
    const interfacePath = path.join(bundlePath, 'myAuraInterface.intf');
    const interfaceMetaPath = path.join(bundlePath, 'myAuraInterface.intf-meta.xml');
    const tree = new VirtualTreeContainer([
      {
        dirPath: bundlePath,
        children: [path.basename(interfacePath), path.basename(interfaceMetaPath)],
      },
    ]);
    const auraInterfaceMD: SourceComponent = new SourceComponent(
      {
        type: registry.types.auradefinitionbundle,
        name: 'myAuraInterface',
        xml: interfaceMetaPath,
        content: bundlePath,
      },
      tree
    );

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
    const bundlePath = path.join('file', 'path', 'aura', 'myAuraToken');
    const tokensPath = path.join(bundlePath, 'myAuraToken.tokens');
    const tokensMetaPath = path.join(bundlePath, 'myAuraToken.tokens-meta.xml');
    const auraTokenMD: SourceComponent = SourceComponent.createVirtualComponent(
      {
        type: registry.types.auradefinitionbundle,
        name: 'myAuraToken',
        xml: tokensMetaPath,
        content: bundlePath,
      },
      [
        {
          dirPath: bundlePath,
          children: [path.basename(tokensPath), path.basename(tokensMetaPath)],
        },
      ]
    );

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
    const bundlePath = path.join('file', 'path', 'lwc', 'myLWCComponent');
    const htmlPath = path.join(bundlePath, 'myLWCComponent.html');
    const jsPath = path.join(bundlePath, 'myLWCComponent.js');
    const cssPath = path.join(bundlePath, 'myLWCComponent.css');
    const metaPath = path.join(bundlePath, 'myLWCComponent.js-meta.xml');
    const lwcMD: SourceComponent = SourceComponent.createVirtualComponent(
      {
        type: registry.types.lightningcomponentbundle,
        name: 'myLWCComponent',
        xml: metaPath,
        content: bundlePath,
      },
      [
        {
          dirPath: bundlePath,
          children: [
            path.basename(htmlPath),
            path.basename(jsPath),
            path.basename(cssPath),
            path.basename(metaPath),
          ],
        },
      ]
    );

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
