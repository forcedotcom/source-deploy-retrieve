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
import { MetadataComponent } from '../../src/types';
import { MetadataApi } from '../../src/client/metadataApi';
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
    const deployMetadata = new MetadataApi(mockConnection, registryAccess);
    const conversionCallStub = sandboxStub
      .stub(MetadataConverter.prototype, 'convert')
      .withArgs(components, 'metadata', { type: 'zip' })
      // @ts-ignore
      .resolves({
        zipBuffer: testingBuffer
      });
    // @ts-ignore
    const deployIdStub = sandboxStub.stub(mockConnection.metadata, 'deploy').resolves({
      id: '12345'
    });
    // @ts-ignore
    const deployPollStub = sandboxStub.stub(mockConnection.metadata, 'checkDeployStatus').resolves({
      success: true
    });
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
