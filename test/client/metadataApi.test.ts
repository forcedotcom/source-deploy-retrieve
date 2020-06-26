/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection } from '@salesforce/core';
import { expect } from 'chai';
import { MockTestOrgData } from '@salesforce/core/lib/testSetup';
import { createSandbox } from 'sinon';
import { RegistryAccess, registryData } from '../../src/metadata-registry';
import { MetadataComponent } from '../../src/types';
import { MetadataApi } from '../../src/client/metadataApi';
import { MetadataConverter } from '../../src/convert';
import { fail } from 'assert';

describe('Metadata Api', () => {
  let mockConnection: Connection;
  let sandboxStub = createSandbox();
  const testData = new MockTestOrgData();
  const registryAccess = new RegistryAccess();
  const components: MetadataComponent[] = [
    {
      fullName: 'myTestClass',
      type: registryData.types.apexclass,
      xml: 'myTestClass.cls-meta.xml',
      sources: ['file/path/myTestClass.cls', 'file/path/myTestClass.cls-meta.xml']
    }
  ];
  const testingBuffer = Buffer.from('testingBuffer');
  const delpoyOptions = {
    paths: ['file/path/myTestClass.cls']
  };
  let deployMetadata;
  let registryStub;
  let conversionCallStub;
  let deployIdStub;
  beforeEach(async () => {
    sandboxStub = createSandbox();
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username
      })
    });
    // @ts-ignore
  });
  afterEach(() => {
    sandboxStub.restore();
  });
  it('Should correctly deploy metatdata components from paths', async () => {
    deployMetadata = new MetadataApi(mockConnection, registryAccess);
    registryStub = sandboxStub.stub(registryAccess, 'getComponentsFromPath').returns(components);
    conversionCallStub = sandboxStub
      .stub(MetadataConverter.prototype, 'convert')
      .withArgs(components, 'metadata', { type: 'zip' })
      // @ts-ignore
      .resolves({
        zipBuffer: testingBuffer
      });
    // @ts-ignore
    deployIdStub = sandboxStub.stub(mockConnection.metadata, 'deploy').resolves({
      id: '12345'
    });
    // @ts-ignore
    const deployPollStub = sandboxStub.stub(mockConnection.metadata, 'checkDeployStatus').resolves({
      status: 'Succeeded'
    });
    const deploys = await deployMetadata.deployWithPaths(delpoyOptions);
    expect(registryStub.calledImmediatelyBefore(conversionCallStub)).to.be.true;
    expect(conversionCallStub.calledImmediatelyBefore(deployIdStub)).to.be.true;
    expect(deployIdStub.calledImmediatelyBefore(deployPollStub)).to.be.true;
    expect(deploys).to.deep.equal({ status: 'Succeeded' });
  });
  describe('Metadata Status Poll', () => {
    it('should verify successful status poll', async () => {
      deployMetadata = new MetadataApi(mockConnection, registryAccess);
      registryStub = sandboxStub.stub(registryAccess, 'getComponentsFromPath').returns(components);
      conversionCallStub = sandboxStub
        .stub(MetadataConverter.prototype, 'convert')
        .withArgs(components, 'metadata', { type: 'zip' })
        // @ts-ignore
        .resolves({
          zipBuffer: testingBuffer
        });
      // @ts-ignore
      deployIdStub = sandboxStub.stub(mockConnection.metadata, 'deploy').resolves({
        id: '12345'
      });
      sandboxStub
        .stub(mockConnection.metadata, 'checkDeployStatus')
        // @ts-ignore
        .resolves({
          status: 'Succeeded'
        });
      const poll = await mockConnection.metadata.checkDeployStatus('12345');
      await deployMetadata.deployWithPaths(delpoyOptions);
      expect(poll.status).to.equal('Succeeded');
    });
    it('should verify failed status poll', async () => {
      deployMetadata = new MetadataApi(mockConnection, registryAccess);
      registryStub = sandboxStub.stub(registryAccess, 'getComponentsFromPath').returns(components);
      conversionCallStub = sandboxStub
        .stub(MetadataConverter.prototype, 'convert')
        .withArgs(components, 'metadata', { type: 'zip' })
        // @ts-ignore
        .resolves({
          zipBuffer: testingBuffer
        });
      // @ts-ignore
      deployIdStub = sandboxStub.stub(mockConnection.metadata, 'deploy').resolves({
        id: '12345'
      });
      sandboxStub
        .stub(mockConnection.metadata, 'checkDeployStatus')
        // @ts-ignore
        .resolves({
          status: 'Failed'
        });
      try {
        await deployMetadata.deployWithPaths(delpoyOptions);
      } catch (err) {
        expect(err.message).contains('Metadata API request failed');
      }
    });
    it('should verify timeout status poll', async () => {
      deployMetadata = new MetadataApi(mockConnection, registryAccess);
      registryStub = sandboxStub.stub(registryAccess, 'getComponentsFromPath').returns(components);
      conversionCallStub = sandboxStub
        .stub(MetadataConverter.prototype, 'convert')
        .withArgs(components, 'metadata', { type: 'zip' })
        // @ts-ignore
        .resolves({
          zipBuffer: testingBuffer
        });
      // @ts-ignore
      deployIdStub = sandboxStub.stub(mockConnection.metadata, 'deploy').resolves({
        id: '12345'
      });
      // @ts-ignore
      const delpoyOptions = {
        wait: 100,
        paths: ['file/path/myTestClass.cls']
      };
      const deployPollStub = sandboxStub.stub(mockConnection.metadata, 'checkDeployStatus');
      // @ts-ignore
      deployPollStub.resolves({ status: 'Pending' });
      try {
        // @ts-ignore
        await deployMetadata.deployWithPaths(delpoyOptions);
        fail('request should have timed out');
      } catch (err) {
        expect(err.message).contains('Metadata API request timed out');
      }
    });
  });
});
