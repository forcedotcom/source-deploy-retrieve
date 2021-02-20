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
import { join, basename } from 'path';
import { RecordResult } from 'jsforce';
import { createSandbox, SinonSandbox } from 'sinon';
import { nls } from '../../../src/i18n';
import { LwcDeploy } from '../../../src/client/deployStrategies';
import { LightningComponentResource, ToolingCreateResult } from '../../../src/utils/deploy';
import {
  SourceComponent,
  registryData,
  VirtualTreeContainer,
} from '../../../src/metadata-registry';
import { ToolingDeployStatus, ComponentStatus } from '../../../src/client';

const $$ = testSetup();

describe('LWC Deploy Strategy', () => {
  const testMetadataField = {
    apiVersion: '32.0',
    status: 'Active',
  };
  const testData = new MockTestOrgData();
  let mockConnection: Connection;
  let sandboxStub: SinonSandbox;
  let simpleMetaXMLString = '<?xml version="1.0" encoding="UTF-8"?>';
  simpleMetaXMLString += '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">';
  simpleMetaXMLString += '    <apiVersion>32.0</apiVersion>';
  simpleMetaXMLString += '    <status>Active</status>';
  simpleMetaXMLString += '</ApexClass>';

  const bundlePath = join('file', 'path', 'lwc', 'mockLwcCmp');
  const lwcFiles = [
    join(bundlePath, 'mockLwcCmp.js'),
    join(bundlePath, 'mockLwcCmp.html'),
    join(bundlePath, 'mockLwcCmp.js-meta.xml'),
  ];
  const lwcContents = [
    `import { LightningElement } from 'lwc';export default class TestLwc extends LightningElement {}`,
    `<template></template>`,
    simpleMetaXMLString,
  ];
  const tree = new VirtualTreeContainer([
    {
      dirPath: bundlePath,
      children: lwcFiles.map((f) => basename(f)),
    },
  ]);
  const lwcComponent = new SourceComponent(
    {
      type: registryData.types.lightningcomponentbundle,
      name: 'mockLwcCmp',
      content: bundlePath,
      xml: join(bundlePath, 'mockLwcCmp.js-meta.xml'),
    },
    tree
  );
  const testLwcList = [
    {
      FilePath: lwcFiles[0],
      Format: 'js',
      Source: lwcContents[0],
      LightningComponentBundleId: '1dcxxx000000060',
    },
    {
      FilePath: lwcFiles[1],
      Format: 'html',
      Source: lwcContents[1],
      LightningComponentBundleId: '1dcxxx000000060',
    },
    {
      FilePath: lwcFiles[2],
      Format: 'js',
      Source: lwcContents[2],
      LightningComponentBundleId: '1dcxxx000000060',
    },
  ] as LightningComponentResource[];

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

    const mockFS = sandboxStub.stub(fs, 'readFileSync');
    mockFS.withArgs(lwcFiles[0], 'utf8').returns(lwcContents[0]);
    mockFS.withArgs(lwcFiles[1], 'utf8').returns(lwcContents[1]);
    mockFS.withArgs(join(bundlePath, 'mockLwcCmp.js-meta.xml')).returns(simpleMetaXMLString);
  });

  afterEach(() => {
    sandboxStub.restore();
  });

  it('should build list of lightning component resource objects with correct properties', async () => {
    sandboxStub
      .stub(mockConnection.tooling, 'query')
      // @ts-ignore
      .resolves({ records: [] });
    const mockToolingCreate = sandboxStub.stub(mockConnection.tooling, 'create');
    mockToolingCreate.resolves({
      success: true,
      id: '1dcxxx000000060',
      errors: [],
    } as RecordResult);

    const lwcDeploy = new LwcDeploy(mockConnection);
    lwcDeploy.component = lwcComponent;
    const lightningResources = await lwcDeploy.buildResourceList();
    expect(lightningResources).to.deep.include.members(testLwcList);
  });

  it('should filter existing sources by filepath and attach id property for matches', async () => {
    const mockToolingQuery = sandboxStub.stub(mockConnection.tooling, 'query');
    const matches = [
      {
        Id: '1dcxxx000000034',
        Format: 'js',
        FilePath: lwcFiles[0],
        Source: lwcContents[0],
      },
      {
        Id: '1dcxxx000000035',
        Format: 'html',
        FilePath: lwcFiles[1],
        Source: lwcContents[1],
      },
    ];
    // @ts-ignore
    mockToolingQuery.resolves({ records: matches });
    sandboxStub.stub(LwcDeploy.prototype, 'upsertBundle').resolves({
      success: true,
      id: '1dcxxx000000033',
      errors: [],
    } as ToolingCreateResult);

    const lwcDeploy = new LwcDeploy(mockConnection);
    lwcDeploy.component = lwcComponent;
    const lwcResults = await lwcDeploy.buildResourceList();
    expect(lwcResults).to.deep.include.members(matches);
  });

  it('should filter existing sources and keep list unchanged if there are no matches', async () => {
    const mockToolingQuery = sandboxStub.stub(mockConnection.tooling, 'query');
    const matches = [
      {
        Id: '1dcxxx000000035',
        FilePath: join('path', 'to', 'wrong', 'lwc', 'lwcFile', 'lwcFile.html'),
        Format: 'html',
        Source: lwcContents[0],
        LightningComponentBundleId: '1dcxxx000000060',
      },
      {
        Id: '1dcxxx000000036',
        FilePath: 'path/to/wrong/lwc/lwcFile/lwcFile.js',
        Format: 'js',
        Source: lwcContents[1],
        LightningComponentBundleId: '1dcxxx000000060',
      },
    ];
    // @ts-ignore
    mockToolingQuery.resolves({ records: matches });
    sandboxStub.stub(LwcDeploy.prototype, 'upsertBundle').resolves({
      success: true,
      id: '1dcxxx000000033',
      errors: [],
    } as ToolingCreateResult);

    const lwcDeploy = new LwcDeploy(mockConnection);
    lwcDeploy.component = lwcComponent;
    const lwcResults = await lwcDeploy.buildResourceList();
    expect(lwcResults).to.not.deep.include.members(matches);
  });

  it('should create a lightningcomponentbundle given the fullname and metadata', async () => {
    const mockToolingCreate = sandboxStub.stub(mockConnection.tooling, 'create');
    mockToolingCreate.resolves({
      success: true,
      id: '1dcxxx000000034',
      errors: [],
    } as RecordResult);

    sandboxStub.stub(LwcDeploy.prototype, 'buildMetadataField').returns(testMetadataField);
    const lwcDeploy = new LwcDeploy(mockConnection);
    lwcDeploy.component = lwcComponent;
    const bundle = await lwcDeploy.upsertBundle();

    expect(bundle.id).to.equal('1dcxxx000000034');
    expect(bundle.success).to.be.equal(true);
    // tslint:disable-next-line:no-unused-expression
    expect(bundle.errors).to.be.an('array').that.is.empty;
    expect(mockToolingCreate.getCall(0).args[0]).to.equal(lwcComponent.type.name);
    expect(mockToolingCreate.getCall(0).args[1]).to.be.an('object');
  });

  it('should update lightningcomponentbundle given the id and metadata', async () => {
    const mockToolingUpdate = sandboxStub.stub(mockConnection.tooling, 'update');
    mockToolingUpdate.resolves({
      success: true,
      id: '1dcxxx000000034',
      errors: [],
    } as RecordResult);

    sandboxStub.stub(LwcDeploy.prototype, 'buildMetadataField').returns(testMetadataField);
    const lwcDeploy = new LwcDeploy(mockConnection);
    lwcDeploy.component = lwcComponent;
    const bundle = await lwcDeploy.upsertBundle('1dcxxx000000034');

    expect(bundle.id).to.equal('1dcxxx000000034');
    expect(bundle.success).to.be.equal(true);
    // tslint:disable-next-line:no-unused-expression
    expect(bundle.errors).to.be.an('array').that.is.empty;
    expect(mockToolingUpdate.getCall(0).args[0]).to.equal(lwcComponent.type.name);
    expect(mockToolingUpdate.getCall(0).args[1]).to.be.an('object');
  });

  it('should throw an error if there is a problem creating the bundle', async () => {
    sandboxStub.stub(mockConnection.tooling, 'create').resolves({
      success: false,
      id: '',
      errors: ['Unexpected error while creating record'],
    } as RecordResult);

    sandboxStub.stub(LwcDeploy.prototype, 'buildMetadataField').returns(testMetadataField);
    const lwcDeploy = new LwcDeploy(mockConnection);
    lwcDeploy.component = lwcComponent;
    try {
      await lwcDeploy.upsertBundle();
      expect.fail('Should have failed');
    } catch (e) {
      expect(e.message).to.equal(
        nls.localize('error_creating_metadata_type', 'LightningComponentBundle')
      );
      expect(e.name).to.be.equal('DeployError');
    }
  });

  it('should create sources in bundle and return successes in correct shape', async () => {
    const mockToolingCreate = sandboxStub.stub(mockConnection.tooling, 'create');
    mockToolingCreate.resolves({
      success: true,
      id: '1dcxxx000000034',
      errors: [],
    } as RecordResult);

    sandboxStub.stub(LwcDeploy.prototype, 'buildMetadataField').returns(testMetadataField);

    sandboxStub.stub(LwcDeploy.prototype, 'buildResourceList').resolves(testLwcList);

    const mockToolingQuery = sandboxStub.stub(mockConnection.tooling, 'query');
    // @ts-ignore
    mockToolingQuery.resolves({ records: [] });

    const lwc = new LwcDeploy(mockConnection);
    const result = await lwc.deploy(lwcComponent, '');

    expect(result).to.deep.equal({
      id: undefined,
      status: ToolingDeployStatus.Completed,
      success: true,
      components: [
        {
          component: lwcComponent,
          status: ComponentStatus.Created,
          diagnostics: [],
        },
      ],
    });
  });

  it('should format output for creation only failures correctly', async () => {
    sandboxStub.stub(LwcDeploy.prototype, 'buildResourceList').resolves(testLwcList);
    sandboxStub
      .stub(mockConnection.tooling, 'query')
      // @ts-ignore
      .resolves({ records: [] });
    const mockToolingCreate = sandboxStub.stub(mockConnection.tooling, 'create');
    mockToolingCreate.onFirstCall().resolves({
      success: true,
      id: '1dcxxx000000034',
      errors: [],
    } as RecordResult);

    sandboxStub
      .stub(mockConnection.tooling, 'update')
      .throws(new Error('mockLwcCmp.js:1,1 : Unexpected error while creating sources'));

    const updateLwcList = [...testLwcList];
    updateLwcList.forEach((el) => {
      el.Id = '1dcxxx000000034';
      delete el.LightningComponentBundleId;
    });

    const lwcDeploy = new LwcDeploy(mockConnection);
    const deployResult = await lwcDeploy.deploy(lwcComponent, '');

    expect(deployResult).to.deep.equal({
      id: undefined,
      status: ToolingDeployStatus.Failed,
      success: false,
      components: [
        {
          component: lwcComponent,
          status: ComponentStatus.Failed,
          diagnostics: [
            {
              columnNumber: 1,
              lineNumber: 1,
              filePath: lwcFiles[0],
              error: 'Unexpected error while creating sources',
              problemType: 'Error',
            },
            {
              columnNumber: 1,
              lineNumber: 1,
              filePath: lwcFiles[0],
              error: 'Unexpected error while creating sources',
              problemType: 'Error',
            },
            {
              columnNumber: 1,
              lineNumber: 1,
              filePath: lwcFiles[0],
              error: 'Unexpected error while creating sources',
              problemType: 'Error',
            },
          ],
        },
      ],
    });
  });
});
