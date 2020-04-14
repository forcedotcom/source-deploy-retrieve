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
import { Record, RecordResult } from 'jsforce';
import { createSandbox, SinonSandbox } from 'sinon';
import {
  ContainerDeploy,
  DeployStatusEnum,
  ToolingCreateResult
} from '../../../src/client/deployStrategies';
import { nls } from '../../../src/i18n';

const $$ = testSetup();

describe('Container Deploy Strategy', () => {
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
  const apexClassCmp = {
    type: {
      name: 'ApexClass',
      directoryName: 'classes',
      inFolder: false
    },
    fullName: 'one',
    sources: ['file/path/one.cls'],
    xml: 'file/path/one.cls-meta.xml'
  };
  const apexTriggerCmp = {
    type: { name: 'ApexTrigger', directoryName: 'triggers', inFolder: false },
    fullName: 'one',
    sources: ['file/path/one.trigger'],
    xml: 'file/path/one.trigger-meta.xml'
  };
  const apexPageCmp = {
    type: { name: 'ApexPage', directoryName: 'pages', inFolder: false },
    fullName: 'one',
    sources: ['file/path/one.page'],
    xml: 'file/path/one.page-meta.xml'
  };
  const apexComponent = {
    type: {
      name: 'ApexComponent',
      directoryName: 'components',
      inFolder: false
    },
    fullName: 'one',
    sources: ['file/path/one.component'],
    xml: 'file/path/one.component-meta.xml'
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
    mockFS
      .withArgs('file/path/one.component-meta.xml', 'utf8')
      .returns(simpleMetaXMLString);
    mockFS
      .withArgs('file/path/one.page-meta.xml', 'utf8')
      .returns(simpleMetaXMLString);
    mockFS
      .withArgs('file/path/one.trigger-meta.xml', 'utf8')
      .returns(simpleMetaXMLString);
  });

  afterEach(() => {
    sandboxStub.restore();
  });

  it('should create a metadata container', async () => {
    const deployLibrary = new ContainerDeploy(mockConnection);
    const mockToolingCreate = sandboxStub.stub(
      mockConnection.tooling,
      'create'
    );

    mockToolingCreate.resolves({
      success: true,
      id: '1dcxxx000000034',
      errors: []
    } as RecordResult);

    const container = await deployLibrary.createMetadataContainer();

    expect(container.id).to.equal('1dcxxx000000034');
    expect(container.success).to.be.equal(true);
    // tslint:disable-next-line:no-unused-expression
    expect(container.errors).to.be.an('array').that.is.empty;
    expect(mockToolingCreate.getCall(0).args[0]).to.equal('MetadataContainer');
    expect(mockToolingCreate.getCall(0).args[1]).to.be.an('object');
  });

  it('should throw an error when creating a metadata container fails', async () => {
    const deployLibrary = new ContainerDeploy(mockConnection);
    sandboxStub.stub(mockConnection.tooling, 'create').resolves({
      success: false,
      id: '',
      errors: ['Unexpected error while creating record']
    } as RecordResult);
    try {
      await deployLibrary.createMetadataContainer();
      expect.fail('Should have failed');
    } catch (e) {
      expect(e.message).to.equal(nls.localize('beta_tapi_mdcontainer_error'));
      expect(e.name).to.be.equal('DeployError');
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
    const deployLibrary = new ContainerDeploy(mockConnection);
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
    const deployLibrary = new ContainerDeploy(mockConnection);
    sandboxStub.stub(deployLibrary, 'getContentEntity').resolves({});
    const mockToolingCreate = sandboxStub
      .stub(mockConnection.tooling, 'create')
      .resolves({
        success: true,
        id: '400xxx000000034',
        errors: []
      } as RecordResult);

    deployLibrary.component = apexClassCmp;
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
    const deployLibrary = new ContainerDeploy(mockConnection);
    sandboxStub.stub(deployLibrary, 'getContentEntity').resolves({});
    const mockToolingCreate = sandboxStub
      .stub(mockConnection.tooling, 'create')
      .resolves({
        success: true,
        id: '400xxx000000034',
        errors: []
      } as RecordResult);

    deployLibrary.component = apexTriggerCmp;
    const containerMember = await deployLibrary.createContainerMember(
      ['file/path/one.trigger', 'file/path/one.trigger-meta.xml'],
      successfulContainerResult
    );
    expect(containerMember.id).to.equal('400xxx000000034');
    expect(containerMember.success).to.be.equal(true);
    // tslint:disable-next-line:no-unused-expression
    expect(containerMember.errors).to.be.an('array').that.is.empty;
    expect(mockToolingCreate.getCall(0).args[0]).to.equal('ApexTriggerMember');
  });

  it('should create a metadata member type for VisualForce Page', async () => {
    const deployLibrary = new ContainerDeploy(mockConnection);
    sandboxStub.stub(deployLibrary, 'getContentEntity').resolves({});
    const mockToolingCreate = sandboxStub
      .stub(mockConnection.tooling, 'create')
      .resolves({
        success: true,
        id: '400xxx000000034',
        errors: []
      } as RecordResult);

    deployLibrary.component = apexPageCmp;
    const containerMember = await deployLibrary.createContainerMember(
      ['file/path/one.page', 'file/path/one.page-meta.xml'],
      successfulContainerResult
    );
    expect(containerMember.id).to.equal('400xxx000000034');
    expect(containerMember.success).to.be.equal(true);
    // tslint:disable-next-line:no-unused-expression
    expect(containerMember.errors).to.be.an('array').that.is.empty;
    expect(mockToolingCreate.getCall(0).args[0]).to.equal('ApexPageMember');
  });

  it('should create a metadata member type for VisualForce Component', async () => {
    const deployLibrary = new ContainerDeploy(mockConnection);
    sandboxStub.stub(deployLibrary, 'getContentEntity').resolves({});
    const mockToolingCreate = sandboxStub
      .stub(mockConnection.tooling, 'create')
      .resolves({
        success: true,
        id: '400xxx000000034',
        errors: []
      } as RecordResult);

    deployLibrary.component = apexComponent;
    const containerMember = await deployLibrary.createContainerMember(
      ['file/path/one.component', 'file/path/one.component-meta.xml'],
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
    const deployLibrary = new ContainerDeploy(mockConnection);
    sandboxStub.stub(deployLibrary, 'getContentEntity').resolves({});
    const mockToolingCreate = sandboxStub
      .stub(mockConnection.tooling, 'create')
      .resolves({
        success: true,
        id: '400xxx000000034',
        errors: []
      } as RecordResult);

    deployLibrary.component = apexClassCmp;
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
    const deployLibrary = new ContainerDeploy(mockConnection);
    sandboxStub
      .stub(deployLibrary, 'getContentEntity')
      .resolves({ Id: 'a00xxx000000034' });
    const mockToolingCreate = sandboxStub
      .stub(mockConnection.tooling, 'create')
      .resolves({
        success: true,
        id: '400xxx000000034',
        errors: []
      } as RecordResult);

    deployLibrary.component = apexClassCmp;
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
    const deployLibrary = new ContainerDeploy(mockConnection);
    sandboxStub.stub(deployLibrary, 'getContentEntity').resolves({});
    sandboxStub.stub(mockConnection.tooling, 'create').resolves({
      success: false,
      id: '',
      errors: ['Unexpected error while creating record']
    } as RecordResult);

    deployLibrary.component = apexClassCmp;
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
      expect(e.name).to.be.equal('DeployError');
    }
  });

  it('should create a container async request', async () => {
    const deployLibrary = new ContainerDeploy(mockConnection);
    const mockToolingCreate = sandboxStub
      .stub(mockConnection.tooling, 'create')
      .resolves({
        success: true,
        id: '1drxxx000000034',
        errors: []
      } as RecordResult);

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
    const deployLibrary = new ContainerDeploy(mockConnection);
    sandboxStub.stub(mockConnection.tooling, 'create').resolves({
      success: false,
      id: '',
      errors: ['Unexpected error while creating record']
    } as RecordResult);

    try {
      await deployLibrary.createContainerAsyncRequest(
        successfulContainerResult
      );
      expect.fail('Should have failed');
    } catch (e) {
      expect(e.message).to.equal(nls.localize('beta_tapi_car_error'));
      expect(e.name).to.be.equal('DeployError');
    }
  });

  it('should throw an error when creating a container async request', async () => {
    const deployLibrary = new ContainerDeploy(mockConnection);
    sandboxStub.stub(mockConnection.tooling, 'create').throwsException({
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
    const deployLibrary = new ContainerDeploy(mockConnection);
    const mockToolingRetrieve = sandboxStub.stub(
      mockConnection.tooling,
      'retrieve'
    );
    mockToolingRetrieve.onCall(0).resolves({
      State: 'Queued',
      isDeleted: false,
      DeployDetails: null
    } as Record);

    mockToolingRetrieve.onCall(1).resolves({
      State: DeployStatusEnum.Completed,
      isDeleted: false,
      DeployDetails: {
        componentFailures: [],
        componentSuccesses: []
      }
    } as Record);
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
});
