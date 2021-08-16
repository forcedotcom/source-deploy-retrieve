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
import { ContainerDeploy } from '../../../src/client/deployStrategies';
import { nls } from '../../../src/i18n';
import {
  QueryResult,
  ToolingDeployStatus,
  ComponentStatus,
  ToolingCreateResult,
} from '../../../src/client/types';
import { SourceComponent } from '../../../src/resolve';
import { registry } from '../../../src';

const $$ = testSetup();

describe('Container Deploy Strategy', () => {
  let simpleMetaXMLString = '<?xml version="1.0" encoding="UTF-8"?>';
  simpleMetaXMLString += '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">';
  simpleMetaXMLString += '    <apiVersion>32.0</apiVersion>';
  simpleMetaXMLString += '    <status>Active</status>';
  simpleMetaXMLString += '</ApexClass>';
  const successfulContainerResult: ToolingCreateResult = {
    success: true,
    id: '1dcxxx000000034',
    errors: [],
    name: 'VSCode_MDC_',
    message: '',
  };
  const apexClassCmp = new SourceComponent({
    type: registry.types.apexclass,
    name: 'one',
    content: 'file/path/one.cls',
    xml: 'file/path/one.cls-meta.xml',
  });
  const apexTriggerCmp = new SourceComponent({
    type: registry.types.apextrigger,
    name: 'one',
    content: 'file/path/one.trigger',
    xml: 'file/path/one.trigger-meta.xml',
  });
  const apexPageCmp = new SourceComponent({
    type: registry.types.apexpage,
    name: 'one',
    content: 'file/path/one.page',
    xml: 'file/path/one.page-meta.xml',
  });
  const apexComponent = new SourceComponent({
    type: registry.types.apexcomponent,
    name: 'one',
    content: 'file/path/one.component',
    xml: 'file/path/one.component-meta.xml',
  });
  const testData = new MockTestOrgData();
  let mockConnection: Connection;
  let sandboxStub: SinonSandbox;

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
    mockFS.withArgs('file/path/one.cls', 'utf8').returns('public with sharing class TestAPI {}');

    mockFS.withArgs('file/path/one.cls-meta.xml', 'utf8').returns(simpleMetaXMLString);
    mockFS.withArgs('file/path/one.component-meta.xml', 'utf8').returns(simpleMetaXMLString);
    mockFS.withArgs('file/path/one.page-meta.xml', 'utf8').returns(simpleMetaXMLString);
    mockFS.withArgs('file/path/one.trigger-meta.xml', 'utf8').returns(simpleMetaXMLString);
  });

  afterEach(() => {
    sandboxStub.restore();
  });

  it('should create a metadata container', async () => {
    const deployLibrary = new ContainerDeploy(mockConnection);
    const mockToolingCreate = sandboxStub.stub(mockConnection.tooling, 'create');

    mockToolingCreate.resolves({
      success: true,
      id: '1dcxxx000000034',
      errors: [],
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
      errors: ['Unexpected error while creating record'],
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
      message: 'duplicate value found: Name duplicates value on record with id : 1dcxxx000000034',
      name: 'DUPLICATE_VALUE',
      stack:
        'DUPLICATE_VALUE: duplicate value found: Name duplicates value on record with id : 1dcxxx000000034',
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
    sandboxStub.stub(deployLibrary, 'getContentEntity').resolves(undefined);
    const mockToolingCreate = sandboxStub.stub(mockConnection.tooling, 'create').resolves({
      success: true,
      id: '400xxx000000034',
      errors: [],
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
    sandboxStub.stub(deployLibrary, 'getContentEntity').resolves(undefined);
    const mockToolingCreate = sandboxStub.stub(mockConnection.tooling, 'create').resolves({
      success: true,
      id: '400xxx000000034',
      errors: [],
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
    sandboxStub.stub(deployLibrary, 'getContentEntity').resolves(undefined);
    const mockToolingCreate = sandboxStub.stub(mockConnection.tooling, 'create').resolves({
      success: true,
      id: '400xxx000000034',
      errors: [],
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
    sandboxStub.stub(deployLibrary, 'getContentEntity').resolves(undefined);
    const mockToolingCreate = sandboxStub.stub(mockConnection.tooling, 'create').resolves({
      success: true,
      id: '400xxx000000034',
      errors: [],
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
    expect(mockToolingCreate.getCall(0).args[0]).to.equal('ApexComponentMember');
  });

  it('should call tooling api with the correct params when creating a metadata member type for new type', async () => {
    const deployLibrary = new ContainerDeploy(mockConnection);
    sandboxStub.stub(deployLibrary, 'getContentEntity').resolves(undefined);
    const mockToolingCreate = sandboxStub.stub(mockConnection.tooling, 'create').resolves({
      success: true,
      id: '400xxx000000034',
      errors: [],
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
    expect(secondParam.MetadataContainerId).to.equal(successfulContainerResult.id);
    expect(secondParam.FullName).to.equal('one');
    expect(secondParam.Body).to.equal('public with sharing class TestAPI {}');
    expect(secondParam.Metadata).to.deep.equal({
      apiVersion: '32.0',
      status: 'Active',
    });
    expect(secondParam.contentEntityId).to.equal(undefined);
  });

  it('should call tooling api with the correct params when creating a metadata member type for existing type', async () => {
    const deployLibrary = new ContainerDeploy(mockConnection);
    sandboxStub.stub(deployLibrary, 'getContentEntity').resolves('a00xxx000000034');
    const mockToolingCreate = sandboxStub.stub(mockConnection.tooling, 'create').resolves({
      success: true,
      id: '400xxx000000034',
      errors: [],
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
    expect(secondParam.MetadataContainerId).to.equal(successfulContainerResult.id);
    expect(secondParam.FullName).to.equal('one');
    expect(secondParam.Body).to.equal('public with sharing class TestAPI {}');
    expect(secondParam.Metadata).to.deep.equal({
      apiVersion: '32.0',
      status: 'Active',
    });
    expect(secondParam.contentEntityId).to.equal('a00xxx000000034');
  });

  it('should throw error when failing to create a metadata member type', async () => {
    const deployLibrary = new ContainerDeploy(mockConnection);
    sandboxStub.stub(deployLibrary, 'getContentEntity').resolves(undefined);
    sandboxStub.stub(mockConnection.tooling, 'create').resolves({
      success: false,
      id: '',
      errors: ['Unexpected error while creating record'],
    } as RecordResult);

    deployLibrary.component = apexClassCmp;
    try {
      await deployLibrary.createContainerMember(
        ['file/path/one.cls', 'file/path/one.cls-meta.xml'],
        successfulContainerResult
      );
      expect.fail('Should have failed');
    } catch (e) {
      expect(e.message).to.equal(nls.localize('beta_tapi_membertype_error', 'ApexClass'));
      expect(e.name).to.be.equal('DeployError');
    }
  });

  it('should create a container async request', async () => {
    const deployLibrary = new ContainerDeploy(mockConnection);
    const mockToolingCreate = sandboxStub.stub(mockConnection.tooling, 'create').resolves({
      success: true,
      id: '1drxxx000000034',
      errors: [],
    } as RecordResult);

    const car = await deployLibrary.createContainerAsyncRequest(successfulContainerResult);
    expect(car.id).to.equal('1drxxx000000034');
    expect(car.success).to.be.equal(true);
    // tslint:disable-next-line:no-unused-expression
    expect(car.errors).to.be.an('array').that.is.empty;
    expect(mockToolingCreate.getCall(0).args[0]).to.equal('ContainerAsyncRequest');
    expect(mockToolingCreate.getCall(0).args[1]).to.deep.equal({
      MetadataContainerId: successfulContainerResult.id,
    });
  });

  it('should throw an error when creating a container async request fails', async () => {
    const deployLibrary = new ContainerDeploy(mockConnection);
    sandboxStub.stub(mockConnection.tooling, 'create').resolves({
      success: false,
      id: '',
      errors: ['Unexpected error while creating record'],
    } as RecordResult);

    try {
      await deployLibrary.createContainerAsyncRequest(successfulContainerResult);
      expect.fail('Should have failed');
    } catch (e) {
      expect(e.message).to.equal(nls.localize('beta_tapi_car_error'));
      expect(e.name).to.be.equal('DeployError');
    }
  });

  it('should throw an error when creating a container async request', async () => {
    const deployLibrary = new ContainerDeploy(mockConnection);
    sandboxStub.stub(mockConnection.tooling, 'create').throwsException({
      message: 'insufficient access rights on cross-reference id: 1drxx000000xUHs',
      errorCode: 'INSUFFICIENT_ACCESS_ON_CROSS_REFERENCE_ENTITY',
      fields: [],
      name: 'INSUFFICIENT_ACCESS_ON_CROSS_REFERENCE_ENTITY',
    });
    try {
      await deployLibrary.createContainerAsyncRequest(successfulContainerResult);
      expect.fail('Should have failed');
    } catch (e) {
      expect(e.message).to.equal(
        'insufficient access rights on cross-reference id: 1drxx000000xUHs'
      );
      expect(e.name).to.be.equal('INSUFFICIENT_ACCESS_ON_CROSS_REFERENCE_ENTITY');
    }
  });

  it('should poll for a container async request', async () => {
    const deployLibrary = new ContainerDeploy(mockConnection);
    deployLibrary.component = apexClassCmp;
    const mockToolingRetrieve = sandboxStub.stub(mockConnection.tooling, 'retrieve');
    mockToolingRetrieve.onCall(0).resolves({
      State: 'Queued',
      isDeleted: false,
      DeployDetails: null,
    } as Record);

    mockToolingRetrieve.onCall(1).resolves({
      State: ToolingDeployStatus.Completed,
      isDeleted: false,
      DeployDetails: {
        componentFailures: [],
        componentSuccesses: [],
      },
    } as Record);
    const asyncRequestMock: ToolingCreateResult = {
      success: true,
      id: '1drxxx000000034',
      errors: [],
      name: 'TestCAR',
      message: '',
    };
    const pollCAR = await deployLibrary.pollContainerStatus(asyncRequestMock.id);
    expect(pollCAR.State).to.equal('Completed');
  });

  it('should deploy successfully when namespace is defined', async () => {
    const deployLibrary = new ContainerDeploy(mockConnection);
    // mock container creation
    const mockToolingCreate = sandboxStub.stub(mockConnection.tooling, 'create');
    mockToolingCreate.onCall(0).resolves({
      success: true,
      id: '1dcxxx000000034',
      errors: [],
    } as RecordResult);

    // mock tooling query
    const mockToolingQuery = sandboxStub.stub(mockConnection.tooling, 'query');
    mockToolingQuery.resolves({
      size: 1,
      totalSize: 1,
      done: true,
      queryLocator: '',
      entityTypeName: 'ApexClass',
      records: [{ Id: '00' }],
    } as QueryResult);

    // mock container member creation
    mockToolingCreate.onCall(1).resolves({
      success: true,
      id: '400xxx000000034',
      errors: [],
    } as RecordResult);

    // mock container async request creation
    mockToolingCreate.onCall(2).resolves({
      success: true,
      id: '1drxxx000000034',
      errors: [],
    } as RecordResult);

    // mock status check
    sandboxStub.stub(mockConnection.tooling, 'retrieve').resolves({
      State: ToolingDeployStatus.Completed,
      isDeleted: false,
      DeployDetails: {
        componentFailures: [],
        componentSuccesses: [
          {
            changed: true,
            componentType: 'ApexComponent',
            created: true,
            createdDate: '2020-06-19T00:30:38.152+0000',
            deleted: false,
            fileName: 'component/one.component',
            fullName: 'one',
            id: '0992M000000uLGTQA2',
            success: true,
            warning: false,
          },
        ],
      },
    } as Record);
    const result = await deployLibrary.deploy(apexComponent, 't5tr');
    expect(mockToolingCreate.calledThrice).to.be.true;
    expect(mockToolingQuery.calledOnce).to.be.true;
    expect(
      mockToolingQuery.calledWith(
        `Select Id from ApexComponent where Name = 'one' and NamespacePrefix = 't5tr'`
      )
    ).to.be.true;
    expect(result).to.deep.equals({
      id: undefined,
      status: ToolingDeployStatus.Completed,
      success: true,
      components: [
        {
          component: apexComponent,
          diagnostics: [],
          status: ComponentStatus.Changed,
        },
      ],
    });
  });
});
