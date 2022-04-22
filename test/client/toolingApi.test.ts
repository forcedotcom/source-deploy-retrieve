/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection, Messages } from '@salesforce/core';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { expect } from 'chai';
import { createSandbox, SinonSandbox } from 'sinon';
import { AnyJson } from '@salesforce/ts-types';
import { MetadataResolver, SourceComponent } from '../../src/resolve';
import { ComponentStatus, ToolingApi, ToolingDeployStatus } from '../../src/client';
import { ContainerDeploy } from '../../src/client/deployStrategies';
import { registry } from '../../src';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.load('@salesforce/source-deploy-retrieve', 'sdr', ['beta_tapi_membertype_unsupported_error']);

const $$ = testSetup();

describe('Tooling API tests', () => {
  const testMetadataField = {
    apiVersion: '32.0',
    status: 'Active',
  };
  const testData = new MockTestOrgData();
  let mockConnection: Connection;
  let sandboxStub: SinonSandbox;
  const resolver = new MetadataResolver();

  beforeEach(async () => {
    sandboxStub = createSandbox();
    $$.configStubs.GlobalInfo = {
      contents: {
        orgs: Object.assign($$.configStubs.GlobalInfo?.contents?.orgs || {}, {
          [testData.username]: testData as unknown as AnyJson,
        }),
      },
    };
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username,
      }),
    });
  });

  afterEach(() => {
    sandboxStub.restore();
  });

  it('should go ahead with deploy for supported types', async () => {
    const deployLibrary = new ToolingApi(mockConnection, resolver);
    const component = new SourceComponent({
      type: registry.types.apexclass,
      name: 'myTestClass',
      xml: 'myTestClass.cls-meta.xml',
      content: 'file/path/myTestClass.cls',
    });
    sandboxStub.stub(MetadataResolver.prototype, 'getComponentsFromPath').returns([component]);
    sandboxStub.stub(ContainerDeploy.prototype, 'buildMetadataField').returns(testMetadataField);
    const mockContainerDeploy = sandboxStub.stub(ContainerDeploy.prototype, 'deploy').resolves({
      id: '123',
      status: ToolingDeployStatus.Completed,
      success: true,
      components: [
        {
          component,
          diagnostics: [],
          status: ComponentStatus.Changed,
        },
      ],
    });

    await deployLibrary.deployWithPaths('file/path/myTestClass.cls');

    expect(mockContainerDeploy.callCount).to.equal(1);
  });

  it('should exit deploy for unsupported types', async () => {
    sandboxStub.stub(MetadataResolver.prototype, 'getComponentsFromPath').returns([
      new SourceComponent({
        type: registry.types.flexipage,
        name: '',
        xml: '',
      }),
    ]);
    const deployLibrary = new ToolingApi(mockConnection, resolver);

    try {
      await deployLibrary.deployWithPaths('file/path/myTestClass.flexipage');
      expect.fail('Should have failed');
    } catch (e) {
      expect(e.message).to.equal(messages.getMessage('beta_tapi_membertype_unsupported_error', ['FlexiPage']));
      expect(e.name).to.be.equal('SourceClientError');
    }
  });
});
