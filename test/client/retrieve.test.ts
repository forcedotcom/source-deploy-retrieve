/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection } from '@salesforce/core';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as stream from 'stream';
import { createSandbox, SinonSandbox } from 'sinon';
import { ToolingApi } from '../../src/client';
import { MetadataResolver, SourceComponent } from '../../src/resolve';
import { QueryResult, RequestStatus, SourceRetrieveResult } from '../../src/client/types';
import { nls } from '../../src/i18n';
import { fail } from 'assert';
import { ComponentSet, registry } from '../../src';

const $$ = testSetup();
describe('Tooling Retrieve', () => {
  const testData = new MockTestOrgData();
  const resolver = new MetadataResolver();
  let mockConnection: Connection;
  let sandboxStub: SinonSandbox;
  let metaXMLFile = '<?xml version="1.0" encoding="UTF-8"?>\n';
  metaXMLFile += '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">\n';
  metaXMLFile += '\t<apiVersion>32.0</apiVersion>\n';
  metaXMLFile += '\t<status>Active</status>\n';
  metaXMLFile += '</ApexClass>';
  const mdComponents: SourceComponent[] = [
    new SourceComponent({
      type: registry.types.apexclass,
      name: 'myTestClass',
      xml: path.join('file', 'path', 'myTestClass.cls-meta.xml'),
      content: path.join('file', 'path', 'myTestClass.cls'),
    }),
  ];
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

  beforeEach(async () => {
    sandboxStub = createSandbox();
    $$.setConfigStubContents('AuthInfoConfig', {
      contents: await testData.getConfig(),
    });
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username,
      }),
    });
    sandboxStub.stub(fs, 'existsSync').returns(true);
    // @ts-ignore
    sandboxStub.stub(fs, 'lstatSync').returns({ isDirectory: () => false });
    const mockFS = sandboxStub.stub(fs, 'readFileSync');
    mockFS
      .withArgs(path.join('file', 'path', 'MyTestClass.cls'), 'utf8')
      .returns('public with sharing class TestAPI {}');

    mockFS
      .withArgs(path.join('file', 'path', 'MyTestClass.cls-meta.xml'), 'utf8')
      .returns(metaXMLFile);
  });

  afterEach(() => {
    sandboxStub.restore();
  });

  it('should generate correct query to retrieve an ApexClass', async () => {
    sandboxStub.stub(resolver, 'getComponentsFromPath').returns(mdComponents);
    const toolingQueryStub = sandboxStub.stub(mockConnection.tooling, 'query');
    // @ts-ignore
    toolingQueryStub.returns(apexClassQueryResult);

    const stubCreateMetadataFile = sandboxStub.stub(fs, 'createWriteStream');
    sandboxStub.stub(fs, 'closeSync');
    sandboxStub.stub(fs, 'openSync');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stubCreateMetadataFile.onCall(0).returns(new stream.PassThrough() as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stubCreateMetadataFile.onCall(1).returns(new stream.PassThrough() as any);

    const toolingAPI = new ToolingApi(mockConnection, resolver);
    const retrieveOpts = {
      paths: [path.join('file', 'path', 'myTestClass.cls')],
      output: path.join('file', 'path'),
    };
    const retrieveResults: SourceRetrieveResult = await toolingAPI.retrieveWithPaths(retrieveOpts);

    expect(retrieveResults).to.be.a('object');
    expect(retrieveResults.success).to.equal(true);
    expect(
      toolingQueryStub.calledOnceWith(
        `Select Id, ApiVersion, Body, Name, NamespacePrefix, Status from ApexClass where Name = 'myTestClass' and NamespacePrefix = ''`
      )
    ).to.equal(true);
  });

  it('should generate correct query to retrieve an ApexClass using namespace', async () => {
    sandboxStub.stub(resolver, 'getComponentsFromPath').returns(mdComponents);
    const toolingQueryStub = sandboxStub.stub(mockConnection.tooling, 'query');
    // @ts-ignore
    toolingQueryStub.returns(apexClassQueryResult);

    const stubCreateMetadataFile = sandboxStub.stub(fs, 'createWriteStream');
    sandboxStub.stub(fs, 'closeSync');
    sandboxStub.stub(fs, 'openSync');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stubCreateMetadataFile.onCall(0).returns(new stream.PassThrough() as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stubCreateMetadataFile.onCall(1).returns(new stream.PassThrough() as any);

    const toolingAPI = new ToolingApi(mockConnection, resolver);
    const retrieveOpts = {
      paths: [path.join('file', 'path', 'myTestClass.cls')],
      namespace: 'tstr',
      output: path.join('file', 'path'),
    };
    const retrieveResults: SourceRetrieveResult = await toolingAPI.retrieveWithPaths(retrieveOpts);

    expect(retrieveResults).to.be.a('object');
    expect(retrieveResults.success).to.equal(true);
    expect(
      toolingQueryStub.calledOnceWith(
        `Select Id, ApiVersion, Body, Name, NamespacePrefix, Status from ApexClass where Name = 'myTestClass' and NamespacePrefix = 'tstr'`
      )
    ).to.equal(true);
  });

  it('should retrieve an ApexClass using filepath', async () => {
    const component = new SourceComponent({
      type: registry.types.apexclass,
      name: 'myTestClass',
      xml: path.join('file', 'path', 'myTestClass.cls-meta.xml'),
      content: path.join('file', 'path', 'myTestClass.cls'),
    });
    sandboxStub.stub(resolver, 'getComponentsFromPath').returns([component]);

    sandboxStub
      .stub(mockConnection.tooling, 'query')
      // @ts-ignore
      .returns(apexClassQueryResult);

    const stubCreateMetadataFile = sandboxStub.stub(fs, 'createWriteStream');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stubCreateMetadataFile.onCall(0).returns(new stream.PassThrough() as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stubCreateMetadataFile.onCall(1).returns(new stream.PassThrough() as any);
    sandboxStub.stub(fs, 'closeSync');
    sandboxStub.stub(fs, 'openSync');

    const toolingAPI = new ToolingApi(mockConnection, resolver);
    const retrieveOpts = {
      paths: [path.join('file', 'path', 'myTestClass.cls')],
      output: path.join('file', 'path'),
    };
    const retrieveResults: SourceRetrieveResult = await toolingAPI.retrieveWithPaths(retrieveOpts);
    expect(retrieveResults).to.deep.equal({
      success: true,
      status: RequestStatus.Succeeded,
      failures: [],
      successes: [
        {
          component,
        },
      ],
    });
  });

  it('should retrieve an ApexClass using SourceComponents', async () => {
    sandboxStub
      .stub(mockConnection.tooling, 'query')
      // @ts-ignore
      .returns(apexClassQueryResult);

    const stubCreateMetadataFile = sandboxStub.stub(fs, 'createWriteStream');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stubCreateMetadataFile.onCall(0).returns(new stream.PassThrough() as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stubCreateMetadataFile.onCall(1).returns(new stream.PassThrough() as any);
    sandboxStub.stub(fs, 'closeSync');
    sandboxStub.stub(fs, 'openSync');

    const toolingAPI = new ToolingApi(mockConnection, resolver);
    const retrieveResults: SourceRetrieveResult = await toolingAPI.retrieve({
      components: new ComponentSet(mdComponents),
    });
    expect(retrieveResults).to.deep.equal({
      success: true,
      status: RequestStatus.Succeeded,
      failures: [],
      successes: [
        {
          component: mdComponents[0],
        },
      ],
    });
  });

  it('should return empty result when metadata is not in org', async () => {
    sandboxStub.stub(resolver, 'getComponentsFromPath').returns(mdComponents);

    sandboxStub
      .stub(mockConnection.tooling, 'query')
      // @ts-ignore
      .returns({ done: true, entityTypeName: 'ApexClass', records: [] });

    const toolingAPI = new ToolingApi(mockConnection, resolver);
    const retrieveOpts = {
      paths: [path.join('file', 'path', 'myTestClass.cls')],
      output: path.join('file', 'path'),
    };
    const retrieveResults: SourceRetrieveResult = await toolingAPI.retrieveWithPaths(retrieveOpts);

    expect(retrieveResults).to.deep.equal({
      successes: [],
      status: RequestStatus.Failed,
      success: false,
      failures: [
        {
          component: {
            fullName: mdComponents[0].fullName,
            type: mdComponents[0].type,
          },
          message: nls.localize('error_md_not_present_in_org', 'myTestClass'),
        },
      ],
    });
  });

  it('should throw an error when trying to retrieve more than one type at a time', async () => {
    mdComponents.push(
      new SourceComponent({
        type: registry.types.apexclass,
        name: 'anotherClass',
        xml: path.join('file', 'path', 'anotherClass.cls-meta.xml'),
        content: path.join('file', 'path', 'anotherClass.cls'),
      })
    );

    const toolingAPI = new ToolingApi(mockConnection, resolver);

    try {
      await toolingAPI.retrieve({
        components: new ComponentSet(mdComponents),
      });
      fail('Retrieve should have thrown an error');
    } catch (e) {
      expect(e.message).to.equals(nls.localize('tapi_retrieve_component_limit_error'));
      expect(e.name).to.equals('MetadataRetrieveLimit');
    }
  });

  it('should throw an error when trying to retrieve an unsupported type', async () => {
    const unsupportedComponent: SourceComponent[] = [
      new SourceComponent({
        type: {
          id: 'fancytype',
          name: 'FancyType',
          directoryName: 'fancy',
          inFolder: false,
          suffix: 'b',
        },
        name: 'anotherOne',
        xml: path.join('file', 'path', 'anotherOne.b-meta.xml'),
        content: path.join('file', 'path', 'anotherOne.b'),
      }),
    ];

    const toolingAPI = new ToolingApi(mockConnection, resolver);

    try {
      await toolingAPI.retrieve({
        components: new ComponentSet(unsupportedComponent),
      });
      fail('Retrieve should have thrown an error');
    } catch (e) {
      expect(e.message).to.equals(
        nls.localize('beta_tapi_membertype_unsupported_error', 'FancyType')
      );
      expect(e.name).to.equals('MetadataTypeUnsupported');
    }
  });
});
