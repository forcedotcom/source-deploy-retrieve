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
import { MetadataApi, DEFAULT_API_OPTIONS } from '../../src/client/metadataApi';
import { MetadataConverter } from '../../src/convert';
import { fail } from 'assert';
import * as path from 'path';
import { nls } from '../../src/i18n';
import { MetadataApiDeployOptions } from '../../src/types/client';

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
      sources: ['myTestClass.cls']
    }
  ];
  const testingBuffer = Buffer.from('testingBuffer');
  const deployPath = path.join('file', 'path', 'myTestClass.cls');
  let deployMetadata: MetadataApi;
  let registryStub = sandboxStub.stub();
  let conversionCallStub = sandboxStub.stub();
  let deployIdStub = sandboxStub.stub();
  beforeEach(async () => {
    sandboxStub = createSandbox();
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username
      })
    });
    deployMetadata = new MetadataApi(mockConnection, registryAccess);
    registryStub = sandboxStub.stub(registryAccess, 'getComponentsFromPath').returns(components);
    conversionCallStub = sandboxStub
      .stub(MetadataConverter.prototype, 'convert')
      .withArgs(components, 'metadata', { type: 'zip' })
      .resolves({
        zipBuffer: testingBuffer
      });
  });
  afterEach(() => {
    sandboxStub.restore();
  });

  it('Should correctly deploy metadata components from paths', async () => {
    // @ts-ignore
    deployIdStub = sandboxStub.stub(mockConnection.metadata, 'deploy').resolves({
      id: '12345'
    });
    // @ts-ignore
    const deployPollStub = sandboxStub.stub(mockConnection.metadata, 'checkDeployStatus').resolves({
      status: 'Succeeded'
    });
    const deploys = await deployMetadata.deployWithPaths(deployPath);
    expect(registryStub.calledImmediatelyBefore(conversionCallStub)).to.be.true;
    expect(conversionCallStub.calledImmediatelyBefore(deployIdStub)).to.be.true;
    expect(deployIdStub.calledImmediatelyBefore(deployPollStub)).to.be.true;
    expect(deploys).to.deep.equal({
      outboundFiles: ['myTestClass.cls', 'myTestClass.cls-meta.xml'],
      status: 'Succeeded'
    });
  });

  it('Should correctly deploy metadata components with custom deploy options', async () => {
    const apiOptions: MetadataApiDeployOptions = {
      allowMissingFiles: true,
      autoUpdatePackage: true,
      checkOnly: true,
      ignoreWarnings: true,
      performRetrieve: true,
      purgeOnDelete: true,
      rollbackOnError: true,
      runAllTests: true,
      runTests: ['test1', 'test2'],
      singlePackage: true
    };
    deployIdStub = sandboxStub
      .stub(mockConnection.metadata, 'deploy')
      .withArgs(testingBuffer, apiOptions)
      // @ts-ignore
      .resolves({
        id: '12345'
      });
    // @ts-ignore
    sandboxStub.stub(mockConnection.metadata, 'checkDeployStatus').resolves({
      status: 'Succeeded'
    });
    await deployMetadata.deployWithPaths(deployPath, { apiOptions });
    expect(deployIdStub.args).to.deep.equal([[testingBuffer, apiOptions]]);
  });

  it('Should correctly deploy metadata components with default deploy options', async () => {
    deployIdStub = sandboxStub
      .stub(mockConnection.metadata, 'deploy')
      .withArgs(testingBuffer, DEFAULT_API_OPTIONS)
      // @ts-ignore
      .resolves({
        id: '12345'
      });
    // @ts-ignore
    sandboxStub.stub(mockConnection.metadata, 'checkDeployStatus').resolves({
      status: 'Succeeded'
    });
    await deployMetadata.deployWithPaths(deployPath);
    expect(deployIdStub.args).to.deep.equal([[testingBuffer, DEFAULT_API_OPTIONS]]);
  });

  it('Should correctly deploy metadata components with default and custom deploy options', async () => {
    const apiOptions: MetadataApiDeployOptions = {
      rollbackOnError: true,
      ignoreWarnings: false,
      checkOnly: true,
      autoUpdatePackage: true
    };
    deployIdStub = sandboxStub
      .stub(mockConnection.metadata, 'deploy')
      .withArgs(testingBuffer, apiOptions)
      // @ts-ignore
      .resolves({
        id: '12345'
      });
    // @ts-ignore
    sandboxStub.stub(mockConnection.metadata, 'checkDeployStatus').resolves({
      status: 'Succeeded'
    });
    await deployMetadata.deployWithPaths(deployPath, {
      apiOptions: { checkOnly: true, autoUpdatePackage: true }
    });
    expect(deployIdStub.args).to.deep.equal([[testingBuffer, apiOptions]]);
  });

  describe('Metadata Status Poll', () => {
    it('should verify successful status poll', async () => {
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
      const deploys = await deployMetadata.deployWithPaths(deployPath);
      expect(deploys).to.deep.equal({
        outboundFiles: ['myTestClass.cls', 'myTestClass.cls-meta.xml'],
        status: 'Succeeded'
      });
    });
    it('should verify failed status poll', async () => {
      // @ts-ignore
      deployIdStub = sandboxStub.stub(mockConnection.metadata, 'deploy').resolves({
        id: '12345'
      });
      const errorMessage = 'Failed deploy';
      sandboxStub
        .stub(mockConnection.metadata, 'checkDeployStatus')
        // @ts-ignore
        .resolves({
          status: 'Failed',
          errorMessage
        });
      try {
        await deployMetadata.deployWithPaths(deployPath);
        fail('request should have failed');
      } catch (err) {
        expect(err.message).contains(nls.localize('md_request_fail', errorMessage));
      }
    });
    it('should verify timeout status poll', async () => {
      // @ts-ignore
      deployIdStub = sandboxStub.stub(mockConnection.metadata, 'deploy').resolves({
        id: '12345'
      });
      const deployOptionWait = {
        wait: 100
      };
      const deployPollStub = sandboxStub.stub(mockConnection.metadata, 'checkDeployStatus');
      // @ts-ignore
      deployPollStub.resolves({ status: 'Pending' });
      try {
        await deployMetadata.deployWithPaths(deployPath, deployOptionWait);
        fail('request should have timed out');
      } catch (err) {
        expect(err.message).contains(nls.localize('md_request_timeout'));
        expect(deployPollStub.callCount).to.be.above(1);
      }
    });
  });
});
