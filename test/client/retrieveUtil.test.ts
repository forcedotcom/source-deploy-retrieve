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

describe('Tooling Retrieve Util', () => {
  const classMDComponent: MetadataComponent = {
    type: {
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
      name: 'ApexPage',
      directoryName: 'pages',
      inFolder: false,
      suffix: 'page'
    },
    fullName: 'myPage',
    xml: path.join('file', 'path', 'myPage.page-meta.xml'),
    sources: [path.join('file', 'path', 'myPage.page')]
  };

  it('should generate correct query to retrieve an ApexClass', () => {
    const queryString = buildQuery(classMDComponent);

    expect(queryString).to.equal(
      `Select Id, ApiVersion, Body, Name, NamespacePrefix, Status from ApexClass where Name = 'myTestClass'`
    );
  });

  it('should generate correct query to retrieve an ApexPage', () => {
    const queryString = buildQuery(pageMDComponent);

    expect(queryString).to.equal(
      `Select Id, ApiVersion, Name, NamespacePrefix, Markup from ApexPage where Name = 'myPage'`
    );
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
    expectedMetaXML +=
      '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">\n';
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
    expectedMetaXML +=
      '<ApexPage xmlns="http://soap.sforce.com/2006/04/metadata">\n';
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
    const overrideOutputPath = path.join(
      'file',
      'different',
      'path',
      'myTestClass.cls'
    );
    const resultMap = queryToFileMap(
      apexPageQueryResult,
      pageMDComponent,
      overrideOutputPathMeta
    );
    expect(resultMap.size).to.equal(2);
    expect(resultMap.has(overrideOutputPathMeta)).to.be.true;
    let expectedMetaXML = '<?xml version="1.0" encoding="UTF-8"?>\n';
    expectedMetaXML +=
      '<ApexPage xmlns="http://soap.sforce.com/2006/04/metadata">\n';
    expectedMetaXML += '\t<apiVersion>45.0</apiVersion>\n';
    expectedMetaXML += '</ApexPage>';
    expect(resultMap.get(overrideOutputPathMeta)).to.equal(expectedMetaXML);
    expect(resultMap.has(overrideOutputPath)).to.be.true;
    expect(resultMap.get(overrideOutputPath)).to.equal(
      '<apex:page>\n<h1>Hello</h1>\n</apex:page>'
    );
  });
});
