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
import { RegistryAccess, registryData, SourceComponent } from '../../src/metadata-registry';
import { MetadataApi, DEFAULT_API_OPTIONS } from '../../src/client/metadataApi';
import { MetadataConverter } from '../../src/convert';
import { fail } from 'assert';
import * as path from 'path';
import { nls } from '../../src/i18n';
import { MetadataApiDeployOptions } from '../../src/types/client';
import {
  DeployResult,
  ComponentStatus,
  DeployStatus,
  SourceDeployResult
} from '../../src/types/newClient';

describe('Metadata Api', () => {
  let mockConnection: Connection;
  let sandboxStub = createSandbox();
  const testData = new MockTestOrgData();
  const registryAccess = new RegistryAccess();
  const rootPath = path.join('file', 'path');
  const props = {
    name: 'myTestClass',
    type: registryData.types.apexclass,
    xml: path.join(rootPath, 'myTestClass.cls-meta.xml'),
    content: path.join(rootPath, 'myTestClass.cls')
  };
  const component = SourceComponent.createVirtualComponent(props, [
    {
      dirPath: rootPath,
      children: [path.basename(props.xml), path.basename(props.content)]
    }
  ]);
  const deployResult: DeployResult = {
    id: '12345',
    status: DeployStatus.Succeeded,
    success: true,
    details: {
      componentSuccesses: [
        // @ts-ignore
        {
          fullName: component.fullName,
          success: 'true'
        }
      ]
    }
  };
  const sourceDeployResult: SourceDeployResult = {
    id: '12345',
    success: true,
    status: DeployStatus.Succeeded,
    components: [
      {
        component,
        status: ComponentStatus.Unchanged,
        diagnostics: []
      }
    ]
  };
  const testingBuffer = Buffer.from('testingBuffer');
  const deployPath = path.join('file', 'path', 'myTestClass.cls');
  let metadataClient: MetadataApi;
  let registryStub = sandboxStub.stub();
  let convertStub = sandboxStub.stub();
  let deployIdStub = sandboxStub.stub();
  beforeEach(async () => {
    sandboxStub = createSandbox();
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username
      })
    });
    metadataClient = new MetadataApi(mockConnection, registryAccess);
    registryStub = sandboxStub.stub(registryAccess, 'getComponentsFromPath').returns([component]);
    convertStub = sandboxStub
      .stub(MetadataConverter.prototype, 'convert')
      .withArgs([component], 'metadata', { type: 'zip' })
      .resolves({
        zipBuffer: testingBuffer
      });
  });
  afterEach(() => {
    sandboxStub.restore();
  });

  it('Should check that the default options are correct', async () => {
    const defaultOptions = {
      rollbackOnError: true,
      ignoreWarnings: false,
      checkOnly: false,
      singlePackage: true
    };
    expect(DEFAULT_API_OPTIONS).to.deep.equal(defaultOptions);
  });

  it('Should correctly deploy metadata components from paths', async () => {
    // @ts-ignore minimum info required
    deployIdStub = sandboxStub.stub(mockConnection.metadata, 'deploy').resolves({
      id: '12345'
    });

    const deployPollStub = sandboxStub
      .stub(mockConnection.metadata, 'checkDeployStatus')
      .withArgs('12345', true)
      // @ts-ignore minimum info required
      .resolves(deployResult);
    const deploys = await metadataClient.deployWithPaths(deployPath);
    expect(registryStub.calledImmediatelyBefore(convertStub)).to.be.true;
    expect(convertStub.calledImmediatelyBefore(deployIdStub)).to.be.true;
    expect(deployIdStub.calledImmediatelyBefore(deployPollStub)).to.be.true;
    expect(deploys).to.deep.equal(sourceDeployResult);
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
    sandboxStub.stub(mockConnection.metadata, 'checkDeployStatus').resolves(deployResult);
    await metadataClient.deployWithPaths(deployPath, { apiOptions });
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
    sandboxStub.stub(mockConnection.metadata, 'checkDeployStatus').resolves(deployResult);
    await metadataClient.deployWithPaths(deployPath);
    expect(deployIdStub.args).to.deep.equal([[testingBuffer, DEFAULT_API_OPTIONS]]);
  });

  it('Should correctly deploy metadata components with default and custom deploy options', async () => {
    const apiOptions: MetadataApiDeployOptions = {
      rollbackOnError: true,
      ignoreWarnings: false,
      checkOnly: true,
      autoUpdatePackage: true,
      singlePackage: false
    };
    deployIdStub = sandboxStub
      .stub(mockConnection.metadata, 'deploy')
      .withArgs(testingBuffer, apiOptions)
      // @ts-ignore
      .resolves({
        id: '12345'
      });
    // @ts-ignore
    sandboxStub.stub(mockConnection.metadata, 'checkDeployStatus').resolves(deployResult);
    await metadataClient.deployWithPaths(deployPath, {
      apiOptions: { checkOnly: true, autoUpdatePackage: true, singlePackage: false }
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
        .resolves(deployResult);
      const deploys = await metadataClient.deployWithPaths(deployPath);
      expect(deploys).to.deep.equal(sourceDeployResult);
    });
    it('should throw correct error for unexpected issue', async () => {
      // @ts-ignore
      deployIdStub = sandboxStub.stub(mockConnection.metadata, 'deploy').resolves({
        id: '12345'
      });
      sandboxStub.stub(mockConnection.metadata, 'checkDeployStatus').throws('unexpected error');
      try {
        await metadataClient.deployWithPaths(deployPath);
        fail('request should have failed');
      } catch (e) {
        expect(e.message).contains(nls.localize('md_request_fail', 'unexpected error'));
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
      deployPollStub.resolves({ status: 'Pending', success: false });
      const result = await metadataClient.deployWithPaths(deployPath, deployOptionWait);
      expect(result.status).to.equal('Pending');
      expect(result.success).to.be.false;
    });
  });

  describe('Metadata Deploy Result', () => {
    it('should set deploy operation status correctly', async () => {
      // @ts-ignore
      sandboxStub.stub(mockConnection.metadata, 'deploy').resolves({
        id: '12345'
      });
      sandboxStub
        .stub(mockConnection.metadata, 'checkDeployStatus')
        // @ts-ignore minimum info required
        .resolves({
          success: true,
          id: '1234',
          status: 'Succeeded'
        });
      const result = await metadataClient.deploy(component);
      expect(result).to.deep.equal({
        id: '1234',
        success: true,
        status: 'Succeeded'
      });
    });

    it('should set Changed component status for changed component', async () => {
      // @ts-ignore
      sandboxStub.stub(mockConnection.metadata, 'deploy').resolves({
        id: '12345'
      });
      sandboxStub
        .stub(mockConnection.metadata, 'checkDeployStatus')
        // @ts-ignore minimum info required
        .resolves({
          success: true,
          id: '1234',
          status: 'Succeeded',
          details: {
            // @ts-ignore
            componentSuccesses: [
              {
                changed: 'true',
                created: 'false',
                deleted: 'false',
                fullName: component.fullName,
                componentType: component.type.name
              }
            ]
          }
        });
      const result = await metadataClient.deploy(component);
      expect(result.components).to.deep.equal([
        {
          component,
          status: ComponentStatus.Changed,
          diagnostics: []
        }
      ]);
    });

    it('should set Created component status for created component', async () => {
      // @ts-ignore
      sandboxStub.stub(mockConnection.metadata, 'deploy').resolves({
        id: '12345'
      });
      sandboxStub
        .stub(mockConnection.metadata, 'checkDeployStatus')
        // @ts-ignore minimum info required
        .resolves({
          success: true,
          id: '1234',
          status: 'Succeeded',
          details: {
            // @ts-ignore
            componentSuccesses: [
              {
                changed: 'false',
                created: 'true',
                deleted: 'false',
                fullName: component.fullName,
                componentType: component.type.name
              }
            ]
          }
        });
      const result = await metadataClient.deploy(component);
      expect(result.components).to.deep.equal([
        {
          component,
          status: ComponentStatus.Created,
          diagnostics: []
        }
      ]);
    });

    it('should set Deleted component status for deleted component', async () => {
      // @ts-ignore
      sandboxStub.stub(mockConnection.metadata, 'deploy').resolves({
        id: '12345'
      });
      sandboxStub
        .stub(mockConnection.metadata, 'checkDeployStatus')
        // @ts-ignore minimum info required
        .resolves({
          success: true,
          id: '1234',
          status: 'Succeeded',
          details: {
            // @ts-ignore
            componentSuccesses: {
              changed: 'false',
              created: 'false',
              deleted: 'true',
              fullName: component.fullName,
              componentType: component.type.name
            }
          }
        });
      const result = await metadataClient.deploy(component);
      expect(result.components).to.deep.equal([
        {
          component,
          status: ComponentStatus.Deleted,
          diagnostics: []
        }
      ]);
    });

    it('should set Failed component status for failed component', async () => {
      // @ts-ignore
      sandboxStub.stub(mockConnection.metadata, 'deploy').resolves({
        id: '12345'
      });
      sandboxStub
        .stub(mockConnection.metadata, 'checkDeployStatus')
        // @ts-ignore minimum info required
        .resolves({
          success: true,
          id: '1234',
          status: 'Failed',
          details: {
            // @ts-ignore
            componentFailures: {
              success: 'false',
              changed: 'false',
              created: 'false',
              deleted: 'false',
              fullName: component.fullName,
              componentType: component.type.name
            }
          }
        });
      const result = await metadataClient.deploy(component);
      expect(result.components).to.deep.equal([
        {
          component,
          status: ComponentStatus.Failed,
          diagnostics: []
        }
      ]);
    });

    it('should aggregate diagnostics for a component', async () => {
      // @ts-ignore
      sandboxStub.stub(mockConnection.metadata, 'deploy').resolves({
        id: '12345'
      });
      sandboxStub
        .stub(mockConnection.metadata, 'checkDeployStatus')
        // @ts-ignore minimum info required
        .resolves({
          success: true,
          id: '1234',
          status: 'Failed',
          details: {
            // @ts-ignore
            componentFailures: [
              {
                success: 'false',
                changed: 'false',
                created: 'false',
                deleted: 'false',
                fullName: component.fullName,
                componentType: component.type.name,
                problem: 'Expected ;',
                problemType: 'Error',
                lineNumber: 3,
                columnNumber: 7
              },
              {
                success: 'false',
                changed: 'false',
                created: 'false',
                deleted: 'false',
                fullName: component.fullName,
                componentType: component.type.name,
                problem: 'Symbol test does not exist',
                problemType: 'Error',
                lineNumber: 8,
                columnNumber: 23
              }
            ]
          }
        });
      const result = await metadataClient.deploy(component);
      expect(result.components).to.deep.equal([
        {
          component,
          status: ComponentStatus.Failed,
          diagnostics: [
            {
              lineNumber: 3,
              columnNumber: 7,
              message: 'Expected ;',
              type: 'Error'
            },
            {
              lineNumber: 8,
              columnNumber: 23,
              message: 'Symbol test does not exist',
              type: 'Error'
            }
          ]
        }
      ]);
    });
  });
});
