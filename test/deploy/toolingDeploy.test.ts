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
import { createSandbox, SinonSandbox } from 'sinon';
import {
  ToolingCreateResult,
  Deploy,
  ToolingRetrieveResult,
  DeployStatusEnum
} from '../../src/deploy';
import { nls } from '../../src/i18n';
import { RegistryAccess } from '../../src/metadata-registry';

const $$ = testSetup();

describe('Tooling Deploys', () => {
  let simpleMetaXMLString = '<?xml version="1.0" encoding="UTF-8"?>';
  simpleMetaXMLString +=
    '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">';
  simpleMetaXMLString += '    <apiVersion>32.0</apiVersion>';
  simpleMetaXMLString += '    <status>Active</status>';
  simpleMetaXMLString += '</ApexClass>';
  const successfulContainerResult: ToolingCreateResult = {
    success: true,
    id: '1dcxxx000000034',
    errors: [],
    name: 'VSCode_MDC_',
    message: ''
  };
  const testData = new MockTestOrgData();
  let mockConnection: Connection;
  let sandboxStub: SinonSandbox;

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
    mockFS
      .withArgs('file/path/one.cls', 'utf8')
      .returns('public with sharing class TestAPI {}');

    mockFS
      .withArgs('file/path/one.cls-meta.xml', 'utf8')
      .returns(simpleMetaXMLString);
  });

  afterEach(() => {
    sandboxStub.restore();
  });

  it('should create a metadata field', () => {
    const deployLibrary = new Deploy(mockConnection);
    const testMetadataField = {
      apiVersion: '32.0',
      status: 'Active'
    };
    const metadataField = deployLibrary.buildMetadataField(simpleMetaXMLString);
    expect(metadataField).to.deep.equals(testMetadataField);
  });

  // Looks like we do not process more than one package version in -meta.xml
  it('should create a metadata field with package versions', () => {
    const deployLibrary = new Deploy(mockConnection);
    const testMetadataField = {
      apiVersion: '47.0',
      status: 'Active',
      packageVersions: '      1      0      packageA    '
    };
    let metaXMLString = '<?xml version="1.0" encoding="UTF-8"?>';
    metaXMLString +=
      '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">';
    metaXMLString += '    <apiVersion>47.0</apiVersion>';
    metaXMLString += '    <packageVersions>';
    metaXMLString += '      <majorNumber>1</majorNumber>';
    metaXMLString += '      <minorNumber>0</minorNumber>';
    metaXMLString += '      <namespace>packageA</namespace>';
    metaXMLString += '    </packageVersions>';
    metaXMLString += '    <packageVersions>';
    metaXMLString += '      <majorNumber>8</majorNumber>';
    metaXMLString += '      <minorNumber>21</minorNumber>';
    metaXMLString += '      <namespace>packageB</namespace>';
    metaXMLString += '    </packageVersions>';
    metaXMLString += '    <status>Active</status>';
    metaXMLString += '</ApexClass>';

    const metadataField = deployLibrary.buildMetadataField(metaXMLString);
    expect(metadataField).to.deep.equals(testMetadataField);
  });

  it('should create a metadata container', async () => {
    const deployLibrary = new Deploy(mockConnection);
    const mockToolingCreate = sandboxStub.stub(deployLibrary, 'toolingCreate');

    const result: ToolingCreateResult = {
      success: true,
      id: '1dcxxx000000034',
      errors: [],
      name: 'VSCode_MDC_',
      message: ''
    };
    mockToolingCreate.resolves(result);

    const container = await deployLibrary.createMetadataContainer();

    expect(container.id).to.equal('1dcxxx000000034');
    expect(container.success).to.be.equal(true);
    // tslint:disable-next-line:no-unused-expression
    expect(container.errors).to.be.an('array').that.is.empty;
    expect(mockToolingCreate.getCall(0).args[0]).to.equal('MetadataContainer');
    expect(mockToolingCreate.getCall(0).args[1]).to.be.an('object');
  });

  it('should throw an error when creating a metadata container fails', async () => {
    const deployLibrary = new Deploy(mockConnection);
    sandboxStub.stub(deployLibrary, 'toolingCreate').resolves({
      success: false,
      id: '',
      errors: ['Unexpected error while creating record']
    } as ToolingCreateResult);
    try {
      await deployLibrary.createMetadataContainer();
      expect.fail('Should have failed');
    } catch (e) {
      expect(e.message).to.equal(nls.localize('beta_tapi_mdcontainer_error'));
      expect(e.name).to.be.equal('MetadataContainerCreationFailed');
    }
  });

  it('should throw an error when creating a duplicate metadata container', async () => {
    const errorObj = {
      errorCode: 'DUPLICATE_VALUE',
      message:
        'duplicate value found: Name duplicates value on record with id : 1dcxxx000000034',
      name: 'DUPLICATE_VALUE',
      stack:
        'DUPLICATE_VALUE: duplicate value found: Name duplicates value on record with id : 1dcxxx000000034'
    };
    sandboxStub.stub(mockConnection.tooling, 'create').throws(errorObj);
    const deployLibrary = new Deploy(mockConnection);
    try {
      await deployLibrary.createMetadataContainer();
      expect.fail('Should have failed');
    } catch (e) {
      expect(e.message).to.equal(
        'duplicate value found: Name duplicates value on record with id : 1dcxxx000000034'
      );
      expect(e.name).to.be.equal('DUPLICATE_VALUE');
    }
  });

  it('should create a metadata member type for Apex Class', async () => {
    const deployLibrary = new Deploy(mockConnection);
    sandboxStub.stub(deployLibrary, 'getContentEntity').resolves({});
    const mockToolingCreate = sandboxStub
      .stub(deployLibrary, 'toolingCreate')
      .resolves({
        success: true,
        id: '400xxx000000034',
        errors: []
      } as ToolingCreateResult);

    deployLibrary.metadataType = 'ApexClass';
    const containerMember = await deployLibrary.createContainerMember(
      ['file/path/one.cls', 'file/path/one.cls-meta.xml'],
      successfulContainerResult
    );
    expect(containerMember.id).to.equal('400xxx000000034');
    expect(containerMember.success).to.be.equal(true);
    // tslint:disable-next-line:no-unused-expression
    expect(containerMember.errors).to.be.an('array').that.is.empty;
    expect(mockToolingCreate.getCall(0).args[0]).to.equal('ApexClassMember');
  });

  it('should create a metadata member type for Apex Trigger', async () => {
    const deployLibrary = new Deploy(mockConnection);
    sandboxStub.stub(deployLibrary, 'getContentEntity').resolves({});
    const mockToolingCreate = sandboxStub
      .stub(deployLibrary, 'toolingCreate')
      .resolves({
        success: true,
        id: '400xxx000000034',
        errors: []
      } as ToolingCreateResult);

    deployLibrary.metadataType = 'ApexTrigger';
    const containerMember = await deployLibrary.createContainerMember(
      ['file/path/one.cls', 'file/path/one.cls-meta.xml'],
      successfulContainerResult
    );
    expect(containerMember.id).to.equal('400xxx000000034');
    expect(containerMember.success).to.be.equal(true);
    // tslint:disable-next-line:no-unused-expression
    expect(containerMember.errors).to.be.an('array').that.is.empty;
    expect(mockToolingCreate.getCall(0).args[0]).to.equal('ApexTriggerMember');
  });

  it('should create a metadata member type for VisualForce Page', async () => {
    const deployLibrary = new Deploy(mockConnection);
    sandboxStub.stub(deployLibrary, 'getContentEntity').resolves({});
    const mockToolingCreate = sandboxStub
      .stub(deployLibrary, 'toolingCreate')
      .resolves({
        success: true,
        id: '400xxx000000034',
        errors: []
      } as ToolingCreateResult);

    deployLibrary.metadataType = 'ApexPage';
    const containerMember = await deployLibrary.createContainerMember(
      ['file/path/one.cls', 'file/path/one.cls-meta.xml'],
      successfulContainerResult
    );
    expect(containerMember.id).to.equal('400xxx000000034');
    expect(containerMember.success).to.be.equal(true);
    // tslint:disable-next-line:no-unused-expression
    expect(containerMember.errors).to.be.an('array').that.is.empty;
    expect(mockToolingCreate.getCall(0).args[0]).to.equal('ApexPageMember');
  });

  it('should create a metadata member type for VisualForce Component', async () => {
    const deployLibrary = new Deploy(mockConnection);
    sandboxStub.stub(deployLibrary, 'getContentEntity').resolves({});
    const mockToolingCreate = sandboxStub
      .stub(deployLibrary, 'toolingCreate')
      .resolves({
        success: true,
        id: '400xxx000000034',
        errors: []
      } as ToolingCreateResult);

    deployLibrary.metadataType = 'ApexComponent';
    const containerMember = await deployLibrary.createContainerMember(
      ['file/path/one.cls', 'file/path/one.cls-meta.xml'],
      successfulContainerResult
    );
    expect(containerMember.id).to.equal('400xxx000000034');
    expect(containerMember.success).to.be.equal(true);
    // tslint:disable-next-line:no-unused-expression
    expect(containerMember.errors).to.be.an('array').that.is.empty;
    expect(mockToolingCreate.getCall(0).args[0]).to.equal(
      'ApexComponentMember'
    );
  });

  it('should call tooling api with the correct params when creating a metadata member type for new type', async () => {
    const deployLibrary = new Deploy(mockConnection);
    sandboxStub.stub(deployLibrary, 'getContentEntity').resolves({});
    const mockToolingCreate = sandboxStub
      .stub(deployLibrary, 'toolingCreate')
      .resolves({
        success: true,
        id: '400xxx000000034',
        errors: []
      } as ToolingCreateResult);

    deployLibrary.metadataType = 'ApexClass';
    await deployLibrary.createContainerMember(
      ['file/path/one.cls', 'file/path/one.cls-meta.xml'],
      successfulContainerResult
    );
    expect(mockToolingCreate.getCall(0).args[0]).to.be.equal('ApexClassMember');
    const secondParam = mockToolingCreate.getCall(0).args[1] as {
      MetadataContainerId: string;
      FullName: string;
      Body: string;
      Metadata: { apiVersion: string; status: string };
      contentEntityId: string;
    };
    expect(secondParam).to.be.an('object');
    expect(secondParam.MetadataContainerId).to.equal(
      successfulContainerResult.id
    );
    expect(secondParam.FullName).to.equal('one');
    expect(secondParam.Body).to.equal('public with sharing class TestAPI {}');
    expect(secondParam.Metadata).to.deep.equal({
      apiVersion: '32.0',
      status: 'Active'
    });
    expect(secondParam.contentEntityId).to.equal(undefined);
  });

  it('should call tooling api with the correct params when creating a metadata member type for existing type', async () => {
    const deployLibrary = new Deploy(mockConnection);
    sandboxStub
      .stub(deployLibrary, 'getContentEntity')
      .resolves({ Id: 'a00xxx000000034' });
    const mockToolingCreate = sandboxStub
      .stub(deployLibrary, 'toolingCreate')
      .resolves({
        success: true,
        id: '400xxx000000034',
        errors: []
      } as ToolingCreateResult);

    deployLibrary.metadataType = 'ApexClass';
    await deployLibrary.createContainerMember(
      ['file/path/one.cls', 'file/path/one.cls-meta.xml'],
      successfulContainerResult
    );
    expect(mockToolingCreate.getCall(0).args[0]).to.be.equal('ApexClassMember');
    const secondParam = mockToolingCreate.getCall(0).args[1] as {
      MetadataContainerId: string;
      FullName: string;
      Body: string;
      Metadata: { apiVersion: string; status: string };
      contentEntityId: string;
    };
    expect(secondParam).to.be.an('object');
    expect(secondParam.MetadataContainerId).to.equal(
      successfulContainerResult.id
    );
    expect(secondParam.FullName).to.equal('one');
    expect(secondParam.Body).to.equal('public with sharing class TestAPI {}');
    expect(secondParam.Metadata).to.deep.equal({
      apiVersion: '32.0',
      status: 'Active'
    });
    expect(secondParam.contentEntityId).to.equal('a00xxx000000034');
  });

  it('should throw error when failing to create a metadata member type', async () => {
    const deployLibrary = new Deploy(mockConnection);
    sandboxStub.stub(deployLibrary, 'getContentEntity').resolves({});
    sandboxStub.stub(deployLibrary, 'toolingCreate').resolves({
      success: false,
      id: '',
      errors: ['Unexpected error while creating record']
    } as ToolingCreateResult);

    deployLibrary.metadataType = 'ApexClass';
    try {
      await deployLibrary.createContainerMember(
        ['file/path/one.cls', 'file/path/one.cls-meta.xml'],
        successfulContainerResult
      );
      expect.fail('Should have failed');
    } catch (e) {
      expect(e.message).to.equal(
        nls.localize('beta_tapi_membertype_error', 'ApexClass')
      );
      expect(e.name).to.be.equal('ApexClassMemberCreationFailed');
    }
  });

  it('should create a container async request', async () => {
    const deployLibrary = new Deploy(mockConnection);
    const mockToolingCreate = sandboxStub
      .stub(deployLibrary, 'toolingCreate')
      .resolves({
        success: true,
        id: '1drxxx000000034',
        errors: []
      } as ToolingCreateResult);

    const car = await deployLibrary.createContainerAsyncRequest(
      successfulContainerResult
    );
    expect(car.id).to.equal('1drxxx000000034');
    expect(car.success).to.be.equal(true);
    // tslint:disable-next-line:no-unused-expression
    expect(car.errors).to.be.an('array').that.is.empty;
    expect(mockToolingCreate.getCall(0).args[0]).to.equal(
      'ContainerAsyncRequest'
    );
    expect(mockToolingCreate.getCall(0).args[1]).to.deep.equal({
      MetadataContainerId: successfulContainerResult.id
    });
  });

  it('should throw an error when creating a container async request fails', async () => {
    const deployLibrary = new Deploy(mockConnection);
    sandboxStub.stub(deployLibrary, 'toolingCreate').resolves({
      success: false,
      id: '',
      errors: ['Unexpected error while creating record']
    } as ToolingCreateResult);

    try {
      await deployLibrary.createContainerAsyncRequest(
        successfulContainerResult
      );
      expect.fail('Should have failed');
    } catch (e) {
      expect(e.message).to.equal(nls.localize('beta_tapi_car_error'));
      expect(e.name).to.be.equal('ContainerAsyncRequestFailed');
    }
  });

  it('should throw an error when creating a container async request', async () => {
    const deployLibrary = new Deploy(mockConnection);
    sandboxStub.stub(deployLibrary, 'toolingCreate').throwsException({
      message:
        'insufficient access rights on cross-reference id: 1drxx000000xUHs',
      errorCode: 'INSUFFICIENT_ACCESS_ON_CROSS_REFERENCE_ENTITY',
      fields: [],
      name: 'INSUFFICIENT_ACCESS_ON_CROSS_REFERENCE_ENTITY'
    });
    try {
      await deployLibrary.createContainerAsyncRequest(
        successfulContainerResult
      );
      expect.fail('Should have failed');
    } catch (e) {
      expect(e.message).to.equal(
        'insufficient access rights on cross-reference id: 1drxx000000xUHs'
      );
      expect(e.name).to.be.equal(
        'INSUFFICIENT_ACCESS_ON_CROSS_REFERENCE_ENTITY'
      );
    }
  });

  it('should poll for a container async request', async () => {
    const deployLibrary = new Deploy(mockConnection);
    const mockToolingRetrieve = sandboxStub.stub(
      deployLibrary,
      'toolingRetrieve'
    );
    mockToolingRetrieve.onCall(0).resolves({
      State: DeployStatusEnum.Queued,
      isDeleted: false,
      DeployDetails: null
    } as ToolingRetrieveResult);

    mockToolingRetrieve.onCall(1).resolves({
      State: DeployStatusEnum.Completed,
      isDeleted: false,
      DeployDetails: {
        componentFailures: [],
        componentSuccesses: []
      }
    } as ToolingRetrieveResult);
    const asyncRequestMock: ToolingCreateResult = {
      success: true,
      id: '1drxxx000000034',
      errors: [],
      name: 'TestCAR',
      message: ''
    };
    const pollCAR = await deployLibrary.toolingStatusCheck(asyncRequestMock);
    expect(pollCAR.State).to.equal('Completed');
  });

  it('should go ahead with deploy for supported types', async () => {
    const registryAccess = new RegistryAccess();
    const deployLibrary = new Deploy(mockConnection, '', registryAccess);
    sandboxStub.stub(registryAccess, 'getComponentsFromPath').returns([
      {
        type: { name: 'ApexClass', directoryName: '', inFolder: false },
        fullName: '',
        metaXml: '',
        sources: []
      }
    ]);
    const mockToolingCreate = sandboxStub.stub(deployLibrary, 'toolingCreate');

    mockToolingCreate.resolves({
      success: true,
      id: '1dcxxx000000034',
      errors: [],
      name: 'VSCode_MDC_',
      message: ''
    } as ToolingCreateResult);
    sandboxStub.stub(deployLibrary, 'createContainerMember');
    sandboxStub.stub(deployLibrary, 'createContainerAsyncRequest');
    sandboxStub.stub(deployLibrary, 'toolingStatusCheck');

    await deployLibrary.deploy('dummypath/dummyfile.extension');

    expect(mockToolingCreate.getCall(0).args[0]).to.equal('MetadataContainer');
  });

  it('should exit deploy for unsupported types', async () => {
    const registryAccess = new RegistryAccess();
    sandboxStub.stub(registryAccess, 'getComponentsFromPath').returns([
      {
        type: { name: 'FlexiPage', directoryName: '', inFolder: false },
        fullName: '',
        metaXml: '',
        sources: []
      }
    ]);
    const deployLibrary = new Deploy(mockConnection, '', registryAccess);

    try {
      await deployLibrary.deploy('dummypath/dummyfile.extension');
      expect.fail('Should have failed');
    } catch (e) {
      expect(e.message).to.equal('FlexiPage type not supported');
      expect(e.name).to.be.equal('MetadataTypeUnsupported');
    }
  });
});
