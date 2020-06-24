/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection } from '@salesforce/core';
import { expect } from 'chai';
import { testSetup, MockTestOrgData } from '@salesforce/core/lib/testSetup';
import { createSandbox } from 'sinon';
import { RegistryAccess, registryData } from '../../src/metadata-registry';
import { MetadataComponent, DeployStatusEnum, DeployResult } from '../../src/types';
import { MetadataApi } from '../../src/client/metadataApi';
import { ContainerDeploy } from '../../src/client/deployStrategies';
import { MetadataConverter } from '../../src/convert';

// stub convert for random buffer (buffer.from (string))
// verify metadata deploy called with same buffer
// deployWithPaths - path returns expected components (use registry)
// test polling (last)
const $$ = testSetup();
describe('Metadata Api', () => {
  const testMetadataField = {
    apiVersion: '32.0',
    status: 'Active'
  };
  let mockConnection: Connection;
  let sandboxStub = createSandbox();
  const testData = new MockTestOrgData();
  const registryAccess = new RegistryAccess();
  beforeEach(async () => {
    sandboxStub = createSandbox();
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username
      })
    });
  });
  afterEach(() => {
    sandboxStub.restore();
  });
  it('Should correctly deploy metatdata components from paths', async () => {
    const components: MetadataComponent[] = [
      {
        fullName: 'myTestClass',
        type: registryData.types.apexclass,
        xml: 'myTestClass.cls-meta.xml',
        sources: ['file/path/myTestClass.cls', 'file/path/myTestClass.cls-meta.xml']
      }
    ];
    const testingBuffer = Buffer.from('testingBuffer');
    const registryStub = sandboxStub
      .stub(registryAccess, 'getComponentsFromPath')
      .returns(components);
    const converter = new MetadataConverter();
    const deployMetadata = new MetadataApi(mockConnection, registryAccess);
    const conversionCallStub = sandboxStub
      .stub(converter, 'convert')
      .withArgs(components, 'metadata', { type: 'zip' })
      .returns(
        new Promise(resolve => {
          resolve({
            packagePath: 'file/path',
            zipBuffer: testingBuffer
          });
        })
      );
    const deployIdStub = sandboxStub
      .stub(deployMetadata, 'metadataDeployID')
      .withArgs(testingBuffer)
      .returns(
        new Promise(resolve => {
          resolve('testing');
        })
      );
    const deployPollStub = sandboxStub.stub(mockConnection.metadata, 'checkDeployStatus').returns(
      new Promise(resolve => {
        resolve({
          id: 'testing',
          checkOnly: true,
          completedDate: '',
          createdDate: '',
          done: true,
          errorMessage: '',
          errorStatusCode: '',
          ignoreWarnings: true,
          lastModifiedDate: '',
          numberComponentErrors: 0,
          numberComponentsDeployed: 1,
          numberComponentsTotal: 1,
          numberTestErrors: 0,
          numberTestsCompleted: 1,
          numberTestsTotal: 0,
          rollbackOnError: true,
          startDate: '',
          status: 'Succeeded',
          success: true
        });
      })
    );
    const delpoyOptions = {
      paths: ['file/path/myTestClass.cls']
    };
    const deploys = await deployMetadata.deployWithPaths(delpoyOptions);
    expect(deploys.outboundFiles).to.equal(['file/path/myTestClass.cls']);
    expect(registryStub.calledImmediatelyBefore(conversionCallStub)).to.be.true;
    expect(conversionCallStub.calledImmediatelyBefore(deployPollStub)).to.be.true;
  });
  it('Should correcly poll', () => {});
});
