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
import { RegistryAccess } from '../../src/metadata-registry';
import { ApiResult } from '../../src/types';

const $$ = testSetup();
describe('Tooling Retrieve', () => {
  const testData = new MockTestOrgData();
  let mockConnection: Connection;
  let sandboxStub: SinonSandbox;
  let metaXMLFile = '<?xml version="1.0" encoding="UTF-8"?>\n';
  metaXMLFile +=
    '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">\n';
  metaXMLFile += '\t<apiVersion>32.0</apiVersion>\n';
  metaXMLFile += '\t<status>Active</status>\n';
  metaXMLFile += '</ApexClass>';

  beforeEach(async () => {
    sandboxStub = createSandbox();
    $$.setConfigStubContents('AuthInfoConfig', {
      contents: await testData.getConfig()
    });
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username
      })
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

  it('should create a tooling query', () => {
    const toolingAPI = new ToolingApi(mockConnection);
    const mdComponents = [
      {
        fullName: 'MyTestClass',
        sources: [path.join('file', 'path', 'MyTestClass.cls')],
        type: {
          directoryName: 'classes',
          inFolder: false,
          name: 'ApexClass',
          suffix: 'cls'
        },
        xml: path.join('file', 'path', 'MyTestClass.cls-meta.xml')
      }
    ];
    const query = toolingAPI.buildQuery(mdComponents);
    expect(query).to.equals(
      `Select Id, ApiVersion, Body, Name, NamespacePrefix, Status from ApexClass where Name = 'MyTestClass'`
    );
  });

  it('should retrieve an ApexClass', async () => {
    const registryAccess = new RegistryAccess();
    sandboxStub.stub(registryAccess, 'getComponentsFromPath').returns([
      {
        type: { name: 'ApexClass', directoryName: '', inFolder: false },
        fullName: '',
        xml: '',
        sources: []
      }
    ]);

    sandboxStub.stub(mockConnection.tooling, 'query').returns({
      // @ts-ignore
      done: true,
      entityTypeName: 'ApexClass',
      records: [
        {
          ApiVersion: 32,
          Body: 'public with sharing class myTestClass {}',
          Id: '01pxxx000000034',
          Name: 'myTestClass',
          NamespacePrefix: null,
          Status: 'Active'
        }
      ]
    });

    const stubCreateMetadataFile = sandboxStub.stub(fs, 'createWriteStream');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stubCreateMetadataFile.onCall(0).returns(new stream.PassThrough() as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stubCreateMetadataFile.onCall(1).returns(new stream.PassThrough() as any);

    const toolingAPI = new ToolingApi(mockConnection);
    const retrieveOpts = {
      paths: [path.join('file', 'path', 'MyTestClass.cls')],
      output: path.join('file', 'path')
    };
    const retrieveResults: ApiResult = await toolingAPI.retrieveWithPaths(
      retrieveOpts
    );
    expect(retrieveResults).to.be.a('object');
    expect(retrieveResults.success).to.equal(true);
    expect(retrieveResults.components).to.be.a('Array');
    expect(retrieveResults.components.length).to.equal(1);
    expect(retrieveResults.components[0].fullName).to.equal('MyTestClass');
    expect(retrieveResults.components[0].type).to.be.a('object');
    expect(retrieveResults.components[0].type.name).to.equal('ApexClass');
    expect(retrieveResults.components[0].type.suffix).to.equal('cls');
    expect(retrieveResults.components[0].type.directoryName).to.equal(
      'classes'
    );
    expect(retrieveResults.components[0].type.inFolder).to.equal(false);
    expect(retrieveResults.components[0].xml).to.equal(
      path.join('file', 'path', 'MyTestClass.cls-meta.xml')
    );
    expect(retrieveResults.components[0].sources).to.be.a('Array');
    expect(retrieveResults.components[0].sources.length).to.equal(1);
    expect(retrieveResults.components[0].sources[0]).to.equal(
      path.join('file', 'path', 'MyTestClass.cls')
    );
  });
});
