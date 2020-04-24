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
import { join } from 'path';
import { RecordResult } from 'jsforce';
import { createSandbox, SinonSandbox } from 'sinon';
import { nls } from '../../../src/i18n';
import { DeployResult, DeployStatusEnum } from '../../../src/types';
import {
  auraContents,
  auraComponent,
  auraFiles,
  updateCreateSuccesses,
  createAuraSuccesses,
  testAuraList
} from './auraDeployMocks';
import { AuraDeploy } from '../../../src/client/deployStrategies';

const $$ = testSetup();

describe('Aura Deploy Strategy', () => {
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
    mockFS
      .withArgs(
        join('file', 'path', 'aura', 'mockAuraCmp', 'mockAuraCmp.cmp-meta.xml'),
        'utf8'
      )
      .returns(simpleMetaXMLString);
  });

  afterEach(() => {
    sandboxStub.restore();
  });

  it('should build list of aura definition objects with correct properties', async () => {
    const auraDeploy = new AuraDeploy(mockConnection);
    auraDeploy.component = auraComponent;
    const auraDefinitions = auraDeploy.buildDefList();
    expect(auraDefinitions).to.deep.include.members(testAuraList);
  });

  it('should filter existing sources by def type and attach id property for matches', async () => {
    const mockToolingQuery = sandboxStub.stub(mockConnection.tooling, 'query');
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

    const auraDeploy = new AuraDeploy(mockConnection);
    auraDeploy.component = auraComponent;
    await auraDeploy.filterExistingSources('1dcxxx000000034', testAuraList);
    expect(testAuraList).to.deep.include.members(matches);
  });

  it('should filter existing sources and keep list unchanged if there are no matches', async () => {
    const mockToolingQuery = sandboxStub.stub(mockConnection.tooling, 'query');
    const matches = [
      {
        Id: '1dcxxx000000035',
        FilePath: join(
          'path',
          'to',
          'wrong',
          'aura',
          'auraFile',
          'auraFile.html'
        ),
        Format: 'html',
        DefType: 'wrongType',
        Source: auraContents[0]
      },
      {
        Id: '1dcxxx000000036',
        FilePath: 'path/to/wrong/aura/auraFile/auraFile.js',
        Format: 'js',
        DefType: 'wrongType',
        Source: auraContents[1]
      }
    ];
    // @ts-ignore
    mockToolingQuery.resolves({ records: matches });

    const auraDeploy = new AuraDeploy(mockConnection);
    auraDeploy.component = auraComponent;
    await auraDeploy.filterExistingSources('1dcxxx000000034', testAuraList);
    expect(testAuraList).to.not.deep.include.members(matches);
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
      .stub(AuraDeploy.prototype, 'buildMetadataField')
      .returns(testMetadataField);
    const auraDeploy = new AuraDeploy(mockConnection);
    auraDeploy.component = auraComponent;
    const bundle = await auraDeploy.createBundle();

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
      .stub(AuraDeploy.prototype, 'buildMetadataField')
      .returns(testMetadataField);
    const auraDeploy = new AuraDeploy(mockConnection);
    auraDeploy.component = auraComponent;
    try {
      await auraDeploy.createBundle();
      expect.fail('Should have failed');
    } catch (e) {
      expect(e.message).to.equal(
        nls.localize('error_creating_metadata_type', 'AuraDefinitionBundle')
      );
      expect(e.name).to.be.equal('DeployError');
    }
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

    sandboxStub
      .stub(AuraDeploy.prototype, 'buildMetadataField')
      .returns(testMetadataField);

    sandboxStub.stub(AuraDeploy.prototype, 'filterExistingSources');

    const mockToolingQuery = sandboxStub.stub(mockConnection.tooling, 'query');
    // @ts-ignore
    mockToolingQuery.resolves({ records: [] });

    const auraDeploy = new AuraDeploy(mockConnection);
    const deployResults = await auraDeploy.deploy(auraComponent);

    expect(deployResults.DeployDetails.componentSuccesses).to.deep.equal(
      createAuraSuccesses
    );
    expect(deployResults.DeployDetails.componentFailures.length).to.equal(0);
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

    sandboxStub
      .stub(AuraDeploy.prototype, 'buildMetadataField')
      .returns(testMetadataField);

    const mockToolingQuery = sandboxStub.stub(mockConnection.tooling, 'query');
    // @ts-ignore
    mockToolingQuery.resolves({ records: [{ Id: '1dcxxx000000034' }] });

    const updateAuraSuccesses = [...createAuraSuccesses];
    updateAuraSuccesses.forEach(el => {
      el.changed = true;
      el.created = false;
    });
    const updateAuraList = [...testAuraList];
    updateAuraList.forEach(el => {
      el.Id = '1dcxxx000000034';
    });

    const auraDeploy = new AuraDeploy(mockConnection);
    auraDeploy.component = auraComponent;
    const results = await Promise.all(
      updateAuraList.map(async def => {
        return auraDeploy.upsert(def, '1dcxxx000000035');
      })
    );

    expect(results).to.deep.equal(updateAuraSuccesses);
  });

  it('should format output for creation only successes correctly', async () => {
    sandboxStub
      .stub(AuraDeploy.prototype, 'buildDefList')
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

    const upsertStub = sandboxStub.stub(AuraDeploy.prototype, 'upsert');
    for (let i = 0; i < 8; i++) {
      upsertStub.onCall(i).resolves(createAuraSuccesses[i]);
    }

    const testDeployResult = {
      State: DeployStatusEnum.Completed,
      DeployDetails: {
        componentSuccesses: createAuraSuccesses,
        componentFailures: []
      },
      isDeleted: false,
      outboundFiles: auraFiles,
      ErrorMsg: null
    } as DeployResult;

    const auraDeploy = new AuraDeploy(mockConnection);
    const DeployResult = await auraDeploy.deploy(auraComponent);

    expect(DeployResult.DeployDetails.componentSuccesses).to.deep.equal(
      testDeployResult.DeployDetails.componentSuccesses
    );
    expect(DeployResult.ErrorMsg).to.equal(testDeployResult.ErrorMsg);
    expect(DeployResult.isDeleted).to.equal(testDeployResult.isDeleted);
    expect(DeployResult.outboundFiles).to.deep.equal(
      testDeployResult.outboundFiles
    );
    expect(DeployResult.State).to.equal(testDeployResult.State);
  });

  it('should format output for creation only failures correctly', async () => {
    sandboxStub
      .stub(AuraDeploy.prototype, 'buildDefList')
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

    sandboxStub
      .stub(AuraDeploy.prototype, 'upsert')
      .throws(new Error('Unexpected error while creating sources'));

    const createTestFailures = [
      {
        changed: false,
        created: false,
        deleted: false,
        fileName: join('aura', 'mockAuraCmp', 'mockAuraCmp.cmp'),
        fullName: join('mockAuraCmp', 'mockAuraCmp.cmp'),
        success: false,
        componentType: 'AuraDefinitionBundle',
        problem: 'Unexpected error while creating sources'
      }
    ];

    const testDeployResult = {
      State: DeployStatusEnum.Failed,
      DeployDetails: {
        componentSuccesses: [],
        componentFailures: createTestFailures
      },
      isDeleted: false,
      ErrorMsg: createTestFailures[0].problem
    } as DeployResult;

    const auraDeploy = new AuraDeploy(mockConnection);
    const DeployResult = await auraDeploy.deploy(auraComponent);

    expect(DeployResult.DeployDetails.componentFailures).to.deep.equal(
      testDeployResult.DeployDetails.componentFailures
    );
    expect(DeployResult.ErrorMsg).to.equal(testDeployResult.ErrorMsg);
    expect(DeployResult.isDeleted).to.equal(testDeployResult.isDeleted);
    expect(DeployResult.State).to.equal(testDeployResult.State);
  });

  it('should format output for create and update successes correctly', async () => {
    sandboxStub
      .stub(AuraDeploy.prototype, 'buildDefList')
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

    const upsertStub = sandboxStub.stub(AuraDeploy.prototype, 'upsert');
    for (let i = 0; i < 8; i++) {
      upsertStub.onCall(i).resolves(updateCreateSuccesses[i]);
    }

    const testDeployResult = {
      State: DeployStatusEnum.Completed,
      DeployDetails: {
        componentSuccesses: updateCreateSuccesses,
        componentFailures: []
      },
      isDeleted: false,
      outboundFiles: auraFiles,
      ErrorMsg: null,
      metadataFile: auraComponent.xml
    } as DeployResult;

    const bundleDeploy = new AuraDeploy(mockConnection);
    const DeployResult = await bundleDeploy.deploy(auraComponent);

    expect(DeployResult.DeployDetails.componentSuccesses).to.deep.equal(
      testDeployResult.DeployDetails.componentSuccesses
    );
    expect(DeployResult.ErrorMsg).to.equal(testDeployResult.ErrorMsg);
    expect(DeployResult.isDeleted).to.equal(testDeployResult.isDeleted);
    expect(DeployResult.outboundFiles).to.deep.equal(
      testDeployResult.outboundFiles
    );
    expect(DeployResult.State).to.equal(testDeployResult.State);
  });
});
