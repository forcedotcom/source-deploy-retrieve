/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection } from '@salesforce/core';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { expect } from 'chai';
import { createSandbox, SinonSandbox } from 'sinon';
import { RegistryAccess } from '../../src/metadata-registry';
import { ToolingApi } from '../../src/client';
import { ContainerDeploy } from '../../src/client/deployStrategies';
import { DeployStatusEnum, DeployResult } from '../../src/types';
import { nls } from '../../src/i18n';

const $$ = testSetup();

describe('Tooling API tests', () => {
  const testMetadataField = {
    apiVersion: '32.0',
    status: 'Active'
  };
  const testData = new MockTestOrgData();
  let mockConnection: Connection;
  let sandboxStub: SinonSandbox;
  const registryAccess = new RegistryAccess();

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
  });

  afterEach(() => {
    sandboxStub.restore();
  });

  it('should go ahead with deploy for supported types', async () => {
    const deployLibrary = new ToolingApi(mockConnection, registryAccess);
    sandboxStub
      .stub(RegistryAccess.prototype, 'getComponentsFromPath')
      .returns([
        {
          type: { name: 'ApexClass', directoryName: '', inFolder: false },
          fullName: 'myTestClass',
          xml: 'myTestClass.cls-meta.xml',
          sources: ['file/path/myTestClass.cls']
        }
      ]);
    sandboxStub
      .stub(ContainerDeploy.prototype, 'buildMetadataField')
      .returns(testMetadataField);
    const mockContainerDeploy = sandboxStub
      .stub(ContainerDeploy.prototype, 'deploy')
      .resolves({
        State: DeployStatusEnum.Completed,
        ErrorMsg: null
      } as DeployResult);

    const deployOpts = {
      paths: ['file/path/myTestClass.cls']
    };
    await deployLibrary.deployWithPaths(deployOpts);

    expect(mockContainerDeploy.callCount).to.equal(1);
  });

  it('should exit deploy for unsupported types', async () => {
    sandboxStub
      .stub(RegistryAccess.prototype, 'getComponentsFromPath')
      .returns([
        {
          type: { name: 'FlexiPage', directoryName: '', inFolder: false },
          fullName: '',
          xml: '',
          sources: []
        }
      ]);
    const deployLibrary = new ToolingApi(mockConnection, registryAccess);
    const deployOpts = {
      paths: ['file/path/myTestClass.flexipage']
    };

    try {
      await deployLibrary.deployWithPaths(deployOpts);
      expect.fail('Should have failed');
    } catch (e) {
      expect(e.message).to.equal(
        nls.localize('beta_tapi_membertype_unsupported_error', 'FlexiPage')
      );
      expect(e.name).to.be.equal('SourceClientError');
    }
  });
});
