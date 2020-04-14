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
import { DeployStatusEnum, ToolingDeployResult } from '../../src';
import { nls } from '../../src/i18n';

const $$ = testSetup();

describe('Tooling API tests', () => {
  const testMetadataField = {
    apiVersion: '32.0',
    status: 'Active'
  };
  const testData = new MockTestOrgData();
  const filepath = 'file/path/one.cls';
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
  });

  afterEach(() => {
    sandboxStub.restore();
  });

  it('should go ahead with deploy for supported types', async () => {
    const deployLibrary = new ToolingApi(mockConnection);
    sandboxStub
      .stub(RegistryAccess.prototype, 'getComponentsFromPath')
      .returns([
        {
          type: { name: 'ApexClass', directoryName: '', inFolder: false },
          fullName: '',
          xml: '',
          sources: []
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
      } as ToolingDeployResult);

    await deployLibrary.deploy('dummypath/dummyfile.extension');

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
    const deployLibrary = new ToolingApi(mockConnection);
    deployLibrary.deploy(filepath);

    try {
      await deployLibrary.deploy('dummypath/dummyfile.extension');
      expect.fail('Should have failed');
    } catch (e) {
      expect(e.message).to.equal(
        nls.localize('beta_tapi_membertype_unsupported_error', 'FlexiPage')
      );
      expect(e.name).to.be.equal('SourceClientError');
    }
  });
});
