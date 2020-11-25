/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection } from '@salesforce/core';
import { expect } from 'chai';
import { MockTestOrgData } from '@salesforce/core/lib/testSetup';
import { createSandbox, match, SinonStub } from 'sinon';
import {
  RegistryAccess,
  MetadataResolver,
  registryData,
  SourceComponent,
} from '../../src/metadata-registry';
import { MetadataApi, DEFAULT_API_OPTIONS } from '../../src/client/metadataApi';
import { MetadataConverter } from '../../src/convert';
import { fail } from 'assert';
import { createMockZip } from '../mock/client';
import * as path from 'path';
import { nls } from '../../src/i18n';
import {
  MetadataApiDeployOptions,
  DeployResult,
  ComponentStatus,
  DeployStatus,
  SourceDeployResult,
  RetrieveOptions,
  RetrievePathOptions,
  RetrieveResult,
  RetrieveStatus,
  SourceRetrieveResult,
} from '../../src/client/types';

/* eslint-disable @typescript-eslint/explicit-function-return-type */
describe('Metadata Api', () => {
  let mockConnection: Connection;
  let sandboxStub = createSandbox();
  const testData = new MockTestOrgData();
  const registry = new RegistryAccess();
  const resolver = new MetadataResolver(registry);
  const rootPath = path.join('file', 'path');
  const props = {
    name: 'myTestClass',
    type: registryData.types.apexclass,
    xml: path.join(rootPath, 'myTestClass.cls-meta.xml'),
    content: path.join(rootPath, 'myTestClass.cls'),
  };
  const component = SourceComponent.createVirtualComponent(props, [
    {
      dirPath: rootPath,
      children: [path.basename(props.xml), path.basename(props.content)],
    },
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
          success: 'true',
        },
      ],
    },
  };
  const sourceDeployResult: SourceDeployResult = {
    id: '12345',
    success: true,
    status: DeployStatus.Succeeded,
    components: [
      {
        component,
        status: ComponentStatus.Unchanged,
        diagnostics: [],
      },
    ],
  };
  const testingBuffer = Buffer.from('testingBuffer');
  const deployPath = path.join('file', 'path', 'myTestClass.cls');
  const outputDir = path.join('path', 'to', 'output', 'dir');
  let metadataClient: MetadataApi;
  let registryStub = sandboxStub.stub();
  let convertStub = sandboxStub.stub();
  let deployIdStub = sandboxStub.stub();
  beforeEach(async () => {
    sandboxStub = createSandbox();
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username,
      }),
    });
    metadataClient = new MetadataApi(mockConnection, resolver);
    registryStub = sandboxStub.stub(resolver, 'getComponentsFromPath').returns([component]);
    convertStub = sandboxStub
      .stub(MetadataConverter.prototype, 'convert')
      .withArgs(match.any, 'metadata', { type: 'zip' })
      .resolves({
        zipBuffer: testingBuffer,
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
      singlePackage: true,
    };
    expect(DEFAULT_API_OPTIONS).to.deep.equal(defaultOptions);
  });

  it('Should correctly deploy metadata components from paths', async () => {
    // @ts-ignore minimum info required
    deployIdStub = sandboxStub.stub(mockConnection.metadata, 'deploy').resolves({
      id: '12345',
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
      singlePackage: true,
    };
    deployIdStub = sandboxStub
      .stub(mockConnection.metadata, 'deploy')
      .withArgs(testingBuffer, apiOptions)
      // @ts-ignore
      .resolves({
        id: '12345',
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
        id: '12345',
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
      singlePackage: false,
    };
    deployIdStub = sandboxStub
      .stub(mockConnection.metadata, 'deploy')
      .withArgs(testingBuffer, apiOptions)
      // @ts-ignore
      .resolves({
        id: '12345',
      });
    // @ts-ignore
    sandboxStub.stub(mockConnection.metadata, 'checkDeployStatus').resolves(deployResult);
    await metadataClient.deployWithPaths(deployPath, {
      apiOptions: { checkOnly: true, autoUpdatePackage: true, singlePackage: false },
    });
    expect(deployIdStub.args).to.deep.equal([[testingBuffer, apiOptions]]);
  });

  describe('Metadata Status Poll', () => {
    it('should verify successful status poll', async () => {
      // @ts-ignore
      deployIdStub = sandboxStub.stub(mockConnection.metadata, 'deploy').resolves({
        id: '12345',
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
        id: '12345',
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
        id: '12345',
      });
      const deployOptionWait = {
        wait: 100,
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
        id: '12345',
      });
      sandboxStub
        .stub(mockConnection.metadata, 'checkDeployStatus')
        // @ts-ignore minimum info required
        .resolves({
          success: true,
          id: '1234',
          status: 'Succeeded',
        });
      const result = await metadataClient.deploy(component);
      expect(result).to.deep.equal({
        id: '1234',
        success: true,
        status: 'Succeeded',
      });
    });

    it('should set Changed component status for changed component', async () => {
      // @ts-ignore
      sandboxStub.stub(mockConnection.metadata, 'deploy').resolves({
        id: '12345',
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
                componentType: component.type.name,
              },
            ],
          },
        });
      const result = await metadataClient.deploy(component);
      expect(result.components).to.deep.equal([
        {
          component,
          status: ComponentStatus.Changed,
          diagnostics: [],
        },
      ]);
    });

    it('should set Created component status for created component', async () => {
      // @ts-ignore
      sandboxStub.stub(mockConnection.metadata, 'deploy').resolves({
        id: '12345',
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
                componentType: component.type.name,
              },
            ],
          },
        });
      const result = await metadataClient.deploy(component);
      expect(result.components).to.deep.equal([
        {
          component,
          status: ComponentStatus.Created,
          diagnostics: [],
        },
      ]);
    });

    it('should set Deleted component status for deleted component', async () => {
      // @ts-ignore
      sandboxStub.stub(mockConnection.metadata, 'deploy').resolves({
        id: '12345',
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
              componentType: component.type.name,
            },
          },
        });
      const result = await metadataClient.deploy(component);
      expect(result.components).to.deep.equal([
        {
          component,
          status: ComponentStatus.Deleted,
          diagnostics: [],
        },
      ]);
    });

    it('should set Failed component status for failed component', async () => {
      // @ts-ignore
      sandboxStub.stub(mockConnection.metadata, 'deploy').resolves({
        id: '12345',
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
              componentType: component.type.name,
            },
          },
        });
      const result = await metadataClient.deploy(component);
      expect(result.components).to.deep.equal([
        {
          component,
          status: ComponentStatus.Failed,
          diagnostics: [],
        },
      ]);
    });

    it('should aggregate diagnostics for a component', async () => {
      // @ts-ignore
      sandboxStub.stub(mockConnection.metadata, 'deploy').resolves({
        id: '12345',
      });
      sandboxStub
        .stub(mockConnection.metadata, 'checkDeployStatus')
        // @ts-ignore minimum info required
        .resolves({
          success: false,
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
                columnNumber: 7,
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
                columnNumber: 23,
              },
            ],
          },
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
              type: 'Error',
            },
            {
              lineNumber: 8,
              columnNumber: 23,
              message: 'Symbol test does not exist',
              type: 'Error',
            },
          ],
        },
      ]);
    });

    it('should fix lwc deploy message issue', async () => {
      const bundlePath = path.join('path', 'to', 'lwc', 'test');
      const props = {
        name: 'test',
        type: registryData.types.lightningcomponentbundle,
        xml: path.join(bundlePath, 'test.js-meta.xml'),
        content: bundlePath,
      };
      const component = SourceComponent.createVirtualComponent(props, [
        {
          dirPath: bundlePath,
          children: [path.basename(props.xml), 'test.js', 'test.html'],
        },
      ]);
      // @ts-ignore
      sandboxStub.stub(mockConnection.metadata, 'deploy').resolves({
        id: '12345',
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
                success: 'false',
                changed: 'false',
                created: 'true',
                deleted: 'false',
                fullName: 'markup://c:test', // api should return 'test'
                componentType: component.type.name,
              },
            ],
          },
        });
      const result = await metadataClient.deploy(component);
      expect(result.components).to.deep.equal([
        {
          component,
          status: ComponentStatus.Created,
          diagnostics: [],
        },
      ]);
    });
  });

  describe('Metadata API Retrieve', () => {
    let retrieveStub: SinonStub;
    let retrieveStatusStub: SinonStub;
    let base64ZipWithClass: string;
    let base64EmptyZip: string;

    const defaultRetrieveResult: RetrieveResult = {
      id: '12345',
      status: RetrieveStatus.Succeeded,
      success: true,
      fileProperties: [
        {
          createdById: '1234',
          createdByName: 'test user',
          createdDate: '2020-11-24T13:35:17.712Z',
          fileName: `unpackaged/${component.type.directoryName}/${component.fullName}`,
          fullName: component.fullName,
          id: 'abcd',
          lastModifiedById: '1234',
          lastModifiedByName: 'test user',
          lastModifiedDate: '2020-11-24T13:35:17.712Z',
          type: component.type.name,
        },
      ],
      done: true,
      zipFile: '',
    };

    const rootDestination = path.join(path.sep, 'retrieved', component.type.directoryName);
    const convertedComponent = new SourceComponent({
      name: component.name,
      type: component.type,
      content: path.join(rootDestination, path.basename(component.content)),
      xml: path.join(rootDestination, path.basename(component.xml)),
    });

    before(async () => {
      base64ZipWithClass = (
        await createMockZip([
          'unpackaged/package.xml',
          'unpackaged/classes/myTestClass.cls',
          'unpackaged/classes/myTestClass.cls-meta.xml',
        ])
      ).toString('base64');
      base64EmptyZip = (await createMockZip(['unpackaged/package.xml'])).toString('base64');
      defaultRetrieveResult.zipFile = base64ZipWithClass;
    });

    beforeEach(async () => {
      retrieveStub = sandboxStub
        .stub(mockConnection.metadata, 'retrieve')
        // @ts-ignore
        .resolves({ id: 'xxxxxxx' });

      retrieveStatusStub = sandboxStub
        .stub(mockConnection.metadata, 'checkRetrieveStatus')
        // @ts-ignore
        .resolves(defaultRetrieveResult);
      convertStub
        .withArgs(match.any, 'source', { type: 'directory', outputDirectory: outputDir })
        .resolves({
          packagePath: outputDir,
          converted: [convertedComponent],
        });
    });

    afterEach(() => {
      sandboxStub.restore();
    });

    it('should correctly format retrieve request', async () => {
      const apiVersion = registry.apiVersion;
      const options = {
        components: [component],
        output: outputDir,
      } as RetrieveOptions;
      const retrieveRequest = {
        apiVersion,
        unpackaged: {
          types: { members: 'myTestClass', name: 'ApexClass' },
          version: parseInt(apiVersion),
        },
      };

      await metadataClient.retrieve(options);
      expect(retrieveStub.calledWith(retrieveRequest)).to.be.true;
    });

    it('should convert the retrieved components', async () => {
      const options = {
        components: [component],
        output: outputDir,
      } as RetrieveOptions;

      await metadataClient.retrieve(options);
      expect(
        convertStub.withArgs(match.any, 'source', {
          type: 'directory',
          outputDirectory: outputDir,
        }).calledOnce
      ).to.be.true;
    });

    it('should return successful result in SourceRetrieveResult format', async () => {
      const options = {
        components: [component],
        output: outputDir,
      } as RetrieveOptions;
      const sourceRetrieveResult: SourceRetrieveResult = {
        success: true,
        successes: [
          { component: convertedComponent, properties: defaultRetrieveResult.fileProperties[0] },
        ],
        failures: [],
        id: '12345',
        status: RetrieveStatus.Succeeded,
      };

      const result = await metadataClient.retrieve(options);
      expect(result).to.eql(sourceRetrieveResult);
    });

    it('should return failed result without component matches in SourceRetrieveResult format', async () => {
      retrieveStatusStub.resolves({
        id: '12345',
        status: RetrieveStatus.Succeeded,
        success: false,
        fileProperties: [],
        done: true,
        messages: { fileName: 'testComponent', problem: 'There was an error' },
        zipFile: base64EmptyZip,
      });
      registryStub.returns([]);
      convertStub.resolves([]);

      const options = {
        components: [component],
        output: outputDir,
      } as RetrieveOptions;

      const sourceRetrieveResult: SourceRetrieveResult = {
        id: '12345',
        success: false,
        successes: [],
        failures: [{ message: 'There was an error' }],
        status: RetrieveStatus.Failed,
      };

      const result = await metadataClient.retrieve(options);
      expect(result).to.deep.equal(sourceRetrieveResult);
    });

    it('should return failed result with component matches in SourceRetrieveResult format', async () => {
      retrieveStatusStub.resolves({
        id: '12345',
        status: RetrieveStatus.Failed,
        success: false,
        fileProperties: [],
        done: true,
        messages: {
          fileName: props.name,
          problem: `There was an error with entity of type 'ApexClass' named 'myTestClass'`,
        },
        zipFile: base64EmptyZip,
      });
      const options = {
        components: [component],
        output: outputDir,
      } as RetrieveOptions;

      const problem = `There was an error with entity of type 'ApexClass' named 'myTestClass'`;

      const sourceRetrieveResult: SourceRetrieveResult = {
        id: '12345',
        status: RetrieveStatus.Failed,
        success: false,
        successes: [],
        failures: [
          { component: { fullName: component.fullName, type: component.type }, message: problem },
        ],
      };

      const result = await metadataClient.retrieve(options);
      expect(result).to.eql(sourceRetrieveResult);
    });

    it('should return partial success result when there are successes and failures', async () => {
      retrieveStatusStub.resolves({
        id: '12345',
        status: RetrieveStatus.Succeeded,
        success: false,
        fileProperties: defaultRetrieveResult.fileProperties,
        done: true,
        messages: { fileName: 'testComponent', problem: 'There was an error' },
        zipFile: base64EmptyZip,
      });

      const result = await metadataClient.retrieve({
        components: [component],
        output: outputDir,
      });
      expect(result).to.deep.equal({
        id: '12345',
        success: true,
        successes: [
          { component: convertedComponent, properties: defaultRetrieveResult.fileProperties[0] },
        ],
        failures: [{ message: 'There was an error' }],
        status: RetrieveStatus.PartialSuccess,
      });
    });

    it('should throw an error if theres an error during retrieve or conversion', async () => {
      const errorMsg = 'test error';
      const error = new Error(errorMsg);
      const options = {
        components: [component],
        output: outputDir,
      } as RetrieveOptions;

      retrieveStub.throws(error);
      try {
        await metadataClient.retrieve(options);
        expect.fail('Should have failed');
      } catch (e) {
        expect(e.message).to.equal(errorMsg);
      }
    });

    it('should only retrieve unique components when retrieving with paths', async () => {
      const rootPath = path.join('file', 'path');
      const contentPaths = [
        path.join(rootPath, 'myTestClass1.cls'),
        path.join(rootPath, 'myTestClass2.cls'),
        path.join(rootPath, 'myTestClass3.cls'),
      ];
      const xmlPaths = [
        path.join(rootPath, 'myTestClass1.cls-meta.xml'),
        path.join(rootPath, 'myTestClass2.cls-meta.xml'),
        path.join(rootPath, 'myTestClass3.cls-meta.xml'),
      ];
      const firstProp = {
        name: 'myTestClass1',
        type: registryData.types.apexclass,
        xml: xmlPaths[0],
        content: contentPaths[0],
      };
      const secondProp = {
        name: 'myTestClass2',
        type: registryData.types.apexclass,
        xml: xmlPaths[1],
        content: contentPaths[1],
      };
      const thirdProp = {
        name: 'myTestClass2',
        type: registryData.types.apexclass,
        xml: xmlPaths[1],
        content: contentPaths[1],
      };
      const firstComponent = SourceComponent.createVirtualComponent(firstProp, [
        {
          dirPath: rootPath,
          children: [path.basename(firstProp.xml), path.basename(firstProp.content)],
        },
      ]);
      const secondComponent = SourceComponent.createVirtualComponent(secondProp, [
        {
          dirPath: rootPath,
          children: [path.basename(secondProp.xml), path.basename(secondProp.content)],
        },
      ]);
      const thirdComponent = SourceComponent.createVirtualComponent(thirdProp, [
        {
          dirPath: rootPath,
          children: [path.basename(thirdProp.xml), path.basename(thirdProp.content)],
        },
      ]);
      const wait = 1000;
      const options = {
        paths: contentPaths,
        output: outputDir,
        wait,
      } as RetrievePathOptions;

      const mdRetrieveStub = sandboxStub.stub(metadataClient, 'retrieve');
      registryStub.onFirstCall().returns([firstComponent, secondComponent, thirdComponent]);
      registryStub.onSecondCall().returns([firstComponent, secondComponent, thirdComponent]);
      registryStub.onThirdCall().returns([firstComponent, secondComponent, thirdComponent]);

      await metadataClient.retrieveWithPaths(options);
      expect(
        mdRetrieveStub.calledWith({
          components: [firstComponent, secondComponent, thirdComponent],
          namespace: options.namespace,
          output: options.output,
          wait,
        })
      );
    });
  });
});
