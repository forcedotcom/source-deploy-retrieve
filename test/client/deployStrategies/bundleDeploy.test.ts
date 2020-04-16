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
import { RecordResult } from 'jsforce';
import { createSandbox, SinonSandbox } from 'sinon';
import {
  BundleDeploy,
  BundleMetadataObj
} from '../../../src/client/deployStrategies';
import { nls } from '../../../src/i18n';
import { DeployStatusEnum, ToolingDeployResult } from '../../../src/types';

const $$ = testSetup();

describe('Bundle Deploy Strategy', () => {
  const testMetadataField = {
    apiVersion: '32.0',
    status: 'Active'
  };
  const testData = new MockTestOrgData();
  let mockConnection: Connection;
  let sandboxStub: SinonSandbox;
  let simpleMetaXMLString = '<?xml version="1.0" encoding="UTF-8"?>';
  simpleMetaXMLString +=
    '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">';
  simpleMetaXMLString += '    <apiVersion>32.0</apiVersion>';
  simpleMetaXMLString += '    <status>Active</status>';
  simpleMetaXMLString += '</ApexClass>';

  const auraFiles = [
    'file/path/aura/mockAuraCmp/mockAuraCmp.auradoc',
    'file/path/aura/mockAuraCmp/mockAuraCmp.cmp',
    'file/path/aura/mockAuraCmp/mockAuraCmp.css',
    'file/path/aura/mockAuraCmp/mockAuraCmp.design',
    'file/path/aura/mockAuraCmp/mockAuraCmp.svg',
    'file/path/aura/mockAuraCmp/mockAuraCmpController.js',
    'file/path/aura/mockAuraCmp/mockAuraCmpHelper.js',
    'file/path/aura/mockAuraCmp/mockAuraCmpRenderer.js'
  ];
  const auraContents = [
    '<aura:documentation><aura:description>Documentation</aura:description><aura:example name="ExampleName" ref="exampleComponentName" label="Label">Example Description</aura:example></aura:documentation>',
    '<aura:component></aura:component>',
    '.THIS {}',
    '<design:component></design:component>',
    '<?xml version="1.0" encoding="UTF-8" standalone="no"?><svg></svg>',
    '({myAction : function(component, event, helper) {}})',
    '({helperMethod : function() {}})',
    '({})'
  ];
  const auraComponent = {
    type: {
      name: 'AuraDefinitionBundle',
      directoryName: 'aura',
      inFolder: false
    },
    fullName: 'mockAuraCmp',
    sources: auraFiles,
    xml: 'file/path/aura/mockAuraCmp/mockAuraCmp.cmp-meta.xml'
  };
  const testAuraList = [
    {
      DefType: 'DOCUMENTATION',
      FilePath: auraFiles[0],
      Format: 'XML',
      Source: auraContents[0]
    },
    {
      DefType: 'COMPONENT',
      FilePath: auraFiles[1],
      Format: 'XML',
      Source: auraContents[1]
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
  ] as BundleMetadataObj[];

  const lwcFiles = [
    'file/path/lwc/mockLwcCmp/mockLwcCmp.html',
    'file/path/lwc/mockLwcCmp/mockLwcCmp.js'
  ];
  const lwcContents = [
    `<template></template>`,
    `import { LightningElement } from 'lwc';export default class TestLwc extends LightningElement {}`
  ];
  const lwcComponent = {
    type: {
      name: 'LightningComponentBundle',
      directoryName: 'lwc',
      inFolder: false
    },
    fullName: 'mockLwcCmp',
    sources: lwcFiles,
    xml: 'file/path/lwc/mockLwcCmp/mockLwcCmp.js-meta.xml'
  };
  const testLwcList = [
    { FilePath: lwcFiles[0], Format: 'html', Source: lwcContents[0] },
    { FilePath: lwcFiles[1], Format: 'js', Source: lwcContents[1] }
  ] as BundleMetadataObj[];

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

    const mockFS = sandboxStub.stub(fs, 'readFileSync');

    mockFS.withArgs(auraFiles[0], 'utf8').returns(auraContents[0]);
    mockFS.withArgs(auraFiles[1], 'utf8').returns(auraContents[1]);
    mockFS.withArgs(auraFiles[2], 'utf8').returns(auraContents[2]);
    mockFS.withArgs(auraFiles[3], 'utf8').returns(auraContents[3]);
    mockFS.withArgs(auraFiles[4], 'utf8').returns(auraContents[4]);
    mockFS.withArgs(auraFiles[5], 'utf8').returns(auraContents[5]);
    mockFS.withArgs(auraFiles[6], 'utf8').returns(auraContents[6]);
    mockFS.withArgs(auraFiles[7], 'utf8').returns(auraContents[7]);

    mockFS.withArgs(lwcFiles[0], 'utf8').returns(lwcContents[0]);
    mockFS.withArgs(lwcFiles[1], 'utf8').returns(lwcContents[1]);
    mockFS
      .withArgs('file/path/aura/mockAuraCmp/mockAuraCmp.cmp-meta.xml', 'utf8')
      .returns(simpleMetaXMLString);
  });

  afterEach(() => {
    sandboxStub.restore();
  });

  it('should build list of bundle obj sources with correct properties for AuraDefinitionBundle', async () => {
    const bundleDeploy = new BundleDeploy(mockConnection);
    bundleDeploy.component = auraComponent;
    const auraMetadataObj = bundleDeploy.buildBundleList();
    expect(auraMetadataObj).to.deep.equal(testAuraList);
  });

  it('should build list of bundle obj sources with correct properties for LightningComponentBundle', async () => {
    const bundleDeploy = new BundleDeploy(mockConnection);
    bundleDeploy.component = lwcComponent;
    const lwcMetadataObj = bundleDeploy.buildBundleList();
    expect(lwcMetadataObj).to.deep.equal(testLwcList.reverse());
  });

  it('should filter existing sources by def type for aura and put matches in update list', async () => {
    const mockToolingQuery = sandboxStub.stub(mockConnection.tooling, 'query');
    const defToUpdate: BundleMetadataObj[] = [];
    const defToCreate: BundleMetadataObj[] = [];
    const matches = [
      {
        Id: '1dcxxx000000034',
        DefType: 'COMPONENT',
        Format: 'XML',
        FilePath: auraFiles[1],
        Source: auraContents[1]
      },
      {
        Id: '1dcxxx000000035',
        DefType: 'STYLE',
        Format: 'CSS',
        FilePath: auraFiles[2],
        Source: auraContents[2]
      },
      {
        Id: '1dcxxx000000036',
        DefType: 'DESIGN',
        Format: 'XML',
        FilePath: auraFiles[3],
        Source: auraContents[3]
      }
    ];
    // @ts-ignore
    mockToolingQuery.resolves({ records: matches });

    const bundleDeploy = new BundleDeploy(mockConnection);
    bundleDeploy.component = auraComponent;
    await bundleDeploy.filterExistingSources(
      '1dcxxx000000034',
      testAuraList,
      defToUpdate,
      defToCreate
    );
    expect(defToUpdate).to.deep.equal(matches);
    expect(defToCreate.length).to.equal(5);
  });

  it('should filter existing sources by filePath for lwc and put matches in update list', async () => {
    const mockToolingQuery = sandboxStub.stub(mockConnection.tooling, 'query');
    const defToUpdate: BundleMetadataObj[] = [];
    const defToCreate: BundleMetadataObj[] = [];
    const matches = [
      {
        Id: '1dcxxx000000036',
        FilePath: lwcFiles[1],
        Format: 'js',
        Source: lwcContents[1]
      },
      {
        Id: '1dcxxx000000035',
        FilePath: lwcFiles[0],
        Format: 'html',
        Source: lwcContents[0]
      }
    ];
    // @ts-ignore
    mockToolingQuery.resolves({ records: matches });

    const bundleDeploy = new BundleDeploy(mockConnection);
    bundleDeploy.component = lwcComponent;
    await bundleDeploy.filterExistingSources(
      '1dcxxx000000034',
      testLwcList,
      defToUpdate,
      defToCreate
    );
    expect(defToUpdate).to.deep.equal(matches);
    expect(defToCreate.length).to.equal(0);
  });

  it('should filter existing sources and add to create list if there are no matches', async () => {
    const mockToolingQuery = sandboxStub.stub(mockConnection.tooling, 'query');
    const defToUpdate: BundleMetadataObj[] = [];
    const defToCreate: BundleMetadataObj[] = [];
    const matches = [
      {
        Id: '1dcxxx000000035',
        FilePath: 'path/to/wrong/lwc/lwcFile/lwcFile.html',
        Format: 'html',
        Source: lwcContents[0]
      },
      {
        Id: '1dcxxx000000036',
        FilePath: 'path/to/wrong/lwc/lwcFile/lwcFile.js',
        Format: 'js',
        Source: lwcContents[1]
      }
    ];
    // @ts-ignore
    mockToolingQuery.resolves({ records: matches });

    const bundleDeploy = new BundleDeploy(mockConnection);
    bundleDeploy.component = lwcComponent;
    await bundleDeploy.filterExistingSources(
      '1dcxxx000000034',
      testLwcList,
      defToUpdate,
      defToCreate
    );
    expect(defToUpdate.length).to.deep.equal(0);
    expect(defToCreate.length).to.equal(2);
  });

  it('should create a lightningcomponentbundle given the full name and metadata', async () => {
    const mockToolingCreate = sandboxStub.stub(
      mockConnection.tooling,
      'create'
    );

    mockToolingCreate.resolves({
      success: true,
      id: '1dcxxx000000034',
      errors: []
    } as RecordResult);

    sandboxStub
      .stub(BundleDeploy.prototype, 'buildMetadataField')
      .returns(testMetadataField);
    const bundleDeploy = new BundleDeploy(mockConnection);
    bundleDeploy.component = lwcComponent;
    const bundle = await bundleDeploy.createBundle(lwcComponent);

    expect(bundle.id).to.equal('1dcxxx000000034');
    expect(bundle.success).to.be.equal(true);
    // tslint:disable-next-line:no-unused-expression
    expect(bundle.errors).to.be.an('array').that.is.empty;
    expect(mockToolingCreate.getCall(0).args[0]).to.equal(
      lwcComponent.type.name
    );
    expect(mockToolingCreate.getCall(0).args[1]).to.be.an('object');
  });

  it('should create an auradefinitionbundle given the fullname and metadata', async () => {
    const mockToolingCreate = sandboxStub.stub(
      mockConnection.tooling,
      'create'
    );
    mockToolingCreate.resolves({
      success: true,
      id: '1dcxxx000000034',
      errors: []
    } as RecordResult);

    sandboxStub
      .stub(BundleDeploy.prototype, 'buildMetadataField')
      .returns(testMetadataField);
    const bundleDeploy = new BundleDeploy(mockConnection);
    bundleDeploy.component = auraComponent;
    const bundle = await bundleDeploy.createBundle(auraComponent);

    expect(bundle.id).to.equal('1dcxxx000000034');
    expect(bundle.success).to.be.equal(true);
    // tslint:disable-next-line:no-unused-expression
    expect(bundle.errors).to.be.an('array').that.is.empty;
    expect(mockToolingCreate.getCall(0).args[0]).to.equal(
      auraComponent.type.name
    );
    expect(mockToolingCreate.getCall(0).args[1]).to.be.an('object');
  });

  it('should throw an error if there is a problem creating the bundle', async () => {
    sandboxStub.stub(mockConnection.tooling, 'create').resolves({
      success: false,
      id: '',
      errors: ['Unexpected error while creating record']
    } as RecordResult);

    sandboxStub
      .stub(BundleDeploy.prototype, 'buildMetadataField')
      .returns(testMetadataField);
    const bundleDeploy = new BundleDeploy(mockConnection);
    bundleDeploy.component = auraComponent;
    try {
      await bundleDeploy.createBundle(auraComponent);
      expect.fail('Should have failed');
    } catch (e) {
      expect(e.message).to.equal(
        nls.localize('error_creating_metadata_type', 'AuraDefinitionBundle')
      );
      expect(e.name).to.be.equal('DeployError');
    }
  });

  it('should update sources in bundle and return successes in correct shape', async () => {
    const mockToolingUpdate = sandboxStub.stub(
      mockConnection.tooling,
      'update'
    );
    mockToolingUpdate.resolves({
      success: true,
      id: '1dcxxx000000034',
      errors: []
    } as RecordResult);

    const testSuccesses = [
      {
        changed: true,
        created: false,
        deleted: false,
        fileName: 'lwc/mockLwcCmp/mockLwcCmp.js',
        fullName: 'mockLwcCmp/mockLwcCmp.js',
        success: true,
        componentType: 'LightningComponentBundle'
      },
      {
        changed: true,
        created: false,
        deleted: false,
        fileName: 'lwc/mockLwcCmp/mockLwcCmp.html',
        fullName: 'mockLwcCmp/mockLwcCmp.html',
        success: true,
        componentType: 'LightningComponentBundle'
      }
    ];

    const bundleDeploy = new BundleDeploy(mockConnection);
    bundleDeploy.component = lwcComponent;
    const deployDetailsResult = await bundleDeploy.updateSources(testLwcList);

    expect(deployDetailsResult.componentSuccesses).to.deep.equal(testSuccesses);
    expect(deployDetailsResult.componentFailures.length).to.equal(0);
  });

  it('should create sources in bundle and return successes in correct shape', async () => {
    const mockToolingCreate = sandboxStub.stub(
      mockConnection.tooling,
      'create'
    );
    mockToolingCreate.resolves({
      success: true,
      id: '1dcxxx000000034',
      errors: []
    } as RecordResult);

    const testSuccesses = [
      {
        changed: false,
        created: true,
        deleted: false,
        fileName: 'lwc/mockLwcCmp/mockLwcCmp.js',
        fullName: 'mockLwcCmp/mockLwcCmp.js',
        success: true,
        componentType: 'LightningComponentBundle'
      },
      {
        changed: false,
        created: true,
        deleted: false,
        fileName: 'lwc/mockLwcCmp/mockLwcCmp.html',
        fullName: 'mockLwcCmp/mockLwcCmp.html',
        success: true,
        componentType: 'LightningComponentBundle'
      }
    ];

    const bundleDeploy = new BundleDeploy(mockConnection);
    bundleDeploy.component = lwcComponent;
    const deployDetailsResult = await bundleDeploy.createSources(
      testLwcList,
      '1dcxxx000000039'
    );

    expect(deployDetailsResult.componentSuccesses).to.deep.equal(testSuccesses);
    expect(deployDetailsResult.componentFailures.length).to.equal(0);
  });

  it('should throw a failure when creating sources and return failures in correct shape', async () => {
    const mockToolingCreate = sandboxStub.stub(
      mockConnection.tooling,
      'create'
    );
    mockToolingCreate.throws(
      new Error('Unexpected error while creating sources')
    );
    const testFailure = [
      {
        changed: false,
        created: false,
        deleted: false,
        fileName: 'lwc/mockLwcCmp/mockLwcCmp.js',
        fullName: 'mockLwcCmp/mockLwcCmp.js',
        success: false,
        problem: 'Unexpected error while creating sources',
        componentType: 'LightningComponentBundle'
      }
    ];

    const bundleDeploy = new BundleDeploy(mockConnection);
    bundleDeploy.component = lwcComponent;
    const deployDetailsResult = await bundleDeploy.createSources(
      testLwcList,
      '1dcxxx000000039'
    );

    expect(deployDetailsResult.componentFailures).to.deep.equal(testFailure);
    expect(deployDetailsResult.componentSuccesses.length).to.equal(0);
  });

  it('should format output for creation only successes correctly', async () => {
    sandboxStub
      .stub(BundleDeploy.prototype, 'buildBundleList')
      .returns(testAuraList);
    sandboxStub
      .stub(mockConnection.tooling, 'query')
      // @ts-ignore
      .resolves({ records: [] });
    const mockToolingCreate = sandboxStub.stub(
      mockConnection.tooling,
      'create'
    );
    mockToolingCreate.resolves({
      success: true,
      id: '1dcxxx000000034',
      errors: []
    } as RecordResult);

    const createTestSuccesses = [
      {
        changed: false,
        created: true,
        deleted: false,
        fileName: 'aura/mockAuraCmp/mockAuraCmp.auradoc',
        fullName: 'mockAuraCmp/mockAuraCmp.auradoc',
        success: true,
        componentType: 'AuraDefinitionBundle'
      },
      {
        changed: false,
        created: true,
        deleted: false,
        fileName: 'aura/mockAuraCmp/mockAuraCmp.cmp',
        fullName: 'mockAuraCmp/mockAuraCmp.cmp',
        success: true,
        componentType: 'AuraDefinitionBundle'
      },
      {
        changed: false,
        created: true,
        deleted: false,
        fileName: 'aura/mockAuraCmp/mockAuraCmp.css',
        fullName: 'mockAuraCmp/mockAuraCmp.css',
        success: true,
        componentType: 'AuraDefinitionBundle'
      },
      {
        changed: false,
        created: true,
        deleted: false,
        fileName: 'aura/mockAuraCmp/mockAuraCmp.design',
        fullName: 'mockAuraCmp/mockAuraCmp.design',
        success: true,
        componentType: 'AuraDefinitionBundle'
      },
      {
        changed: false,
        created: true,
        deleted: false,
        fileName: 'aura/mockAuraCmp/mockAuraCmp.svg',
        fullName: 'mockAuraCmp/mockAuraCmp.svg',
        success: true,
        componentType: 'AuraDefinitionBundle'
      },
      {
        changed: false,
        created: true,
        deleted: false,
        fileName: 'mockAuraCmp/mockAuraCmpController.js',
        fullName: 'aura/mockAuraCmp/mockAuraCmpController.js',
        success: true,
        componentType: 'AuraDefinitionBundle'
      },
      {
        changed: false,
        created: true,
        deleted: false,
        fileName: 'aura/mockAuraCmp/mockAuraCmpHelper.js',
        fullName: 'mockAuraCmp/mockAuraCmpHelper.js',
        success: true,
        componentType: 'AuraDefinitionBundle'
      },
      {
        changed: false,
        created: true,
        deleted: false,
        fileName: 'aura/mockAuraCmp/mockAuraCmpRenderer.js',
        fullName: 'mockAuraCmp/mockAuraCmpRenderer.js',
        success: true,
        componentType: 'AuraDefinitionBundle'
      }
    ];
    sandboxStub.stub(BundleDeploy.prototype, 'createSources').resolves({
      componentSuccesses: createTestSuccesses,
      componentFailures: []
    });
    sandboxStub.stub(BundleDeploy.prototype, 'updateSources').resolves({
      componentSuccesses: [],
      componentFailures: []
    });

    const testToolingDeployResult = {
      State: DeployStatusEnum.Completed,
      DeployDetails: {
        componentSuccesses: createTestSuccesses,
        componentFailures: []
      },
      isDeleted: false,
      outboundFiles: auraFiles,
      ErrorMsg: null
    } as ToolingDeployResult;

    const bundleDeploy = new BundleDeploy(mockConnection);
    bundleDeploy.component = auraComponent;
    const toolingDeployResult = await bundleDeploy.deploy(auraComponent);

    expect(toolingDeployResult.DeployDetails.componentSuccesses).to.deep.equal(
      testToolingDeployResult.DeployDetails.componentSuccesses
    );
    expect(toolingDeployResult.ErrorMsg).to.equal(
      testToolingDeployResult.ErrorMsg
    );
    expect(toolingDeployResult.isDeleted).to.equal(
      testToolingDeployResult.isDeleted
    );
    expect(toolingDeployResult.outboundFiles).to.deep.equal(
      testToolingDeployResult.outboundFiles
    );
    expect(toolingDeployResult.State).to.equal(testToolingDeployResult.State);
  });

  it('should format output for creation only failures correctly', async () => {
    sandboxStub
      .stub(BundleDeploy.prototype, 'buildBundleList')
      .returns(testAuraList);
    sandboxStub
      .stub(mockConnection.tooling, 'query')
      // @ts-ignore
      .resolves({ records: [] });
    const mockToolingCreate = sandboxStub.stub(
      mockConnection.tooling,
      'create'
    );
    mockToolingCreate.onFirstCall().resolves({
      success: true,
      id: '1dcxxx000000034',
      errors: []
    } as RecordResult);

    mockToolingCreate
      .onSecondCall()
      .throws(new Error('Unexpected error while creating sources'));

    const createTestFailures = [
      {
        changed: false,
        created: false,
        deleted: false,
        fileName: 'aura/mockAuraCmp/mockAuraCmp.auradoc',
        fullName: 'mockAuraCmp/mockAuraCmp.auradoc',
        success: true,
        componentType: 'AuraDefinitionBundle',
        problem: 'Unexpected error while creating sources'
      }
    ];
    sandboxStub.stub(BundleDeploy.prototype, 'createSources').resolves({
      componentSuccesses: [],
      componentFailures: createTestFailures
    });
    sandboxStub.stub(BundleDeploy.prototype, 'updateSources').resolves({
      componentSuccesses: [],
      componentFailures: []
    });

    const testToolingDeployResult = {
      State: DeployStatusEnum.Failed,
      DeployDetails: {
        componentSuccesses: [],
        componentFailures: createTestFailures
      },
      isDeleted: false,
      ErrorMsg: createTestFailures[0].problem
    } as ToolingDeployResult;

    const bundleDeploy = new BundleDeploy(mockConnection);
    bundleDeploy.component = auraComponent;
    const toolingDeployResult = await bundleDeploy.deploy(auraComponent);

    expect(toolingDeployResult.DeployDetails.componentFailures).to.deep.equal(
      testToolingDeployResult.DeployDetails.componentFailures
    );
    expect(toolingDeployResult.ErrorMsg).to.equal(
      testToolingDeployResult.ErrorMsg
    );
    expect(toolingDeployResult.isDeleted).to.equal(
      testToolingDeployResult.isDeleted
    );
    expect(toolingDeployResult.State).to.equal(testToolingDeployResult.State);
  });

  it('should format output for create and update successes correctly', async () => {
    sandboxStub
      .stub(BundleDeploy.prototype, 'buildBundleList')
      .returns(testAuraList);
    const toolingQueryStub = sandboxStub
      .stub(mockConnection.tooling, 'query')
      .onFirstCall()
      // @ts-ignore
      .resolves({ records: [{ Id: '1dcxxx000000039' }] });

    const matches = [
      {
        Id: '1dcxxx000000034',
        DefType: 'COMPONENT',
        Format: 'XML',
        FilePath: auraFiles[1],
        Source: auraContents[1]
      },
      {
        Id: '1dcxxx000000035',
        DefType: 'STYLE',
        Format: 'CSS',
        FilePath: auraFiles[2],
        Source: auraContents[2]
      },
      {
        Id: '1dcxxx000000036',
        DefType: 'DESIGN',
        Format: 'XML',
        FilePath: auraFiles[3],
        Source: auraContents[3]
      }
    ];
    // @ts-ignore
    toolingQueryStub.onSecondCall().resolves({ records: matches });

    const testUpdateSuccesses = [
      {
        changed: true,
        created: false,
        deleted: false,
        fileName: 'aura/mockAuraCmp/mockAuraCmp.cmp',
        fullName: 'mockAuraCmp/mockAuraCmp.cmp',
        success: true,
        componentType: 'AuraDefinitionBundle'
      },
      {
        changed: true,
        created: false,
        deleted: false,
        fileName: 'aura/mockAuraCmp/mockAuraCmp.css',
        fullName: 'mockAuraCmp/mockAuraCmp.css',
        success: true,
        componentType: 'AuraDefinitionBundle'
      },
      {
        changed: true,
        created: false,
        deleted: false,
        fileName: 'mockAuraCmp/mockAuraCmp.design',
        fullName: 'aura/mockAuraCmp/mockAuraCmp.design',
        success: true,
        componentType: 'AuraDefinitionBundle'
      }
    ];
    sandboxStub.stub(BundleDeploy.prototype, 'updateSources').resolves({
      componentSuccesses: testUpdateSuccesses,
      componentFailures: []
    });

    const testCreateSuccesses = [
      {
        changed: false,
        created: true,
        deleted: false,
        fileName: 'aura/mockAuraCmp/mockAuraCmp.auradoc',
        fullName: 'mockAuraCmp/mockAuraCmp.auradoc',
        success: true,
        componentType: 'AuraDefinitionBundle'
      },
      {
        changed: false,
        created: true,
        deleted: false,
        fileName: 'aura/mockAuraCmp/mockAuraCmp.svg',
        fullName: 'mockAuraCmp/mockAuraCmp.svg',
        success: true,
        componentType: 'AuraDefinitionBundle'
      },
      {
        changed: false,
        created: true,
        deleted: false,
        fileName: 'aura/mockAuraCmp/mockAuraCmpController.js',
        fullName: 'mockAuraCmp/mockAuraCmpController.js',
        success: true,
        componentType: 'AuraDefinitionBundle'
      },
      {
        changed: false,
        created: true,
        deleted: false,
        fileName: 'aura/mockAuraCmp/mockAuraCmpHelper.js',
        fullName: 'mockAuraCmp/mockAuraCmpHelper.js',
        success: true,
        componentType: 'AuraDefinitionBundle'
      },
      {
        changed: false,
        created: true,
        deleted: false,
        fileName: 'mockAuraCmp/mockAuraCmpRenderer.js',
        fullName: 'aura/mockAuraCmp/mockAuraCmpRenderer.js',
        success: true,
        componentType: 'AuraDefinitionBundle'
      }
    ];
    sandboxStub.stub(BundleDeploy.prototype, 'createSources').resolves({
      componentSuccesses: testCreateSuccesses,
      componentFailures: []
    });

    const testToolingDeployResult = {
      State: DeployStatusEnum.Completed,
      DeployDetails: {
        componentSuccesses: testUpdateSuccesses.concat(testCreateSuccesses),
        componentFailures: []
      },
      isDeleted: false,
      outboundFiles: auraFiles,
      ErrorMsg: null
    } as ToolingDeployResult;

    const bundleDeploy = new BundleDeploy(mockConnection);
    bundleDeploy.component = auraComponent;
    const toolingDeployResult = await bundleDeploy.deploy(auraComponent);

    expect(toolingDeployResult.DeployDetails.componentSuccesses).to.deep.equal(
      testToolingDeployResult.DeployDetails.componentSuccesses
    );
    expect(toolingDeployResult.ErrorMsg).to.equal(
      testToolingDeployResult.ErrorMsg
    );
    expect(toolingDeployResult.isDeleted).to.equal(
      testToolingDeployResult.isDeleted
    );
    expect(toolingDeployResult.outboundFiles).to.deep.equal(
      testToolingDeployResult.outboundFiles
    );
    expect(toolingDeployResult.State).to.equal(testToolingDeployResult.State);
  });
});
