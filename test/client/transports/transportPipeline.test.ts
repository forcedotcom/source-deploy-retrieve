/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { expect } from 'chai';
import { Connection, SfProject } from '@salesforce/core';
import { ComponentStatus, FileResponse, RegistryAccess, SourceComponent } from '../../../src';
import { TransportPipeline } from '../../../src/client/transports/transportPipeline';
import {
  AsyncTransportHandle,
  TransportContext,
  TransportDescription,
  TransportProvider,
  TransportResult,
} from '../../../src/client/transports/types';

const registryAccess = new RegistryAccess();

function createMockTransport(
  name: string,
  timing: 'before' | 'after' | 'before-metadata' | 'after-metadata',
  fileResponses: FileResponse[] = []
): TransportProvider {
  const transport: TransportProvider = {
    name: 'herokuCompute',
    describe(): TransportDescription {
      return { label: `Mock ${name}`, endpoint: `https://example.com/${name}` };
    },
    handles: () => true,
  };
  if (timing === 'before' || timing === 'before-metadata') {
    transport.beforeDeploy = async (): Promise<TransportResult> => ({ fileResponses });
  } else transport.afterDeploy = async (): Promise<TransportResult> => ({ fileResponses });
  return transport;
}

function createMockComponent(typeName: string, fullName: string): SourceComponent {
  return new SourceComponent({ name: fullName, type: registryAccess.getTypeByName(typeName) });
}

describe('TransportPipeline', () => {
  describe('groupByTransport', () => {
    it('should put registry-unconfigured components in metadataApi when no transports are registered', () => {
      const pipeline = new TransportPipeline();
      const apexClass = createMockComponent('ApexClass', 'MyClass');
      const customObject = createMockComponent('CustomObject', 'MyObject__c');

      const result = pipeline.groupByTransport([apexClass, customObject]);

      expect(result.metadataApi).to.have.lengthOf(2);
      expect(result.transports).to.have.lengthOf(0);
    });

    it('should group components by transport when transports are registered', () => {
      const mockTransport = createMockTransport('herokuCompute', 'before-metadata');
      const pipeline = new TransportPipeline([mockTransport]);

      const apexClass = createMockComponent('PlatformComputeApp', 'MyApp');
      const customObject = createMockComponent('CustomObject', 'MyObject__c');

      const result = pipeline.groupByTransport([apexClass, customObject]);

      // all components go through metadata api
      expect(result.metadataApi).to.have.lengthOf(2);
      // Configured components also go through their registry transport.
      expect(result.transports).to.have.lengthOf(1);
      expect(result.transports[0].transport.name).to.equal('herokuCompute');
      expect(result.transports[0].components).to.have.lengthOf(1);
      expect(result.transports[0].components[0].fullName).to.equal('MyApp');
    });

    it('should group all configured components for the registry transport', () => {
      const pipeline = new TransportPipeline([createMockTransport('herokuCompute', 'before-metadata')]);

      const apexClass = createMockComponent('PlatformComputeApp', 'MyApp');
      const customObject = createMockComponent('PlatformComputeApp', 'OtherApp');
      const apexTrigger = createMockComponent('ApexTrigger', 'MyTrigger');

      const result = pipeline.groupByTransport([apexClass, customObject, apexTrigger]);

      expect(result.metadataApi).to.have.lengthOf(3);
      expect(result.transports).to.have.lengthOf(1);
      expect(result.transports[0].components).to.have.lengthOf(2);
    });
  });

  describe('hasTransports', () => {
    it('should throw when a registry-configured transport provider is missing', () => {
      const pipeline = new TransportPipeline();
      const app = createMockComponent('PlatformComputeApp', 'MyApp');

      expect(() => pipeline.hasTransports([app])).to.throw('No transport provider is registered');
    });

    it('should return false when no components match a transport', () => {
      const pipeline = new TransportPipeline([createMockTransport('herokuCompute', 'before-metadata')]);

      const apexClass = createMockComponent('ApexClass', 'MyClass');

      expect(pipeline.hasTransports([apexClass])).to.be.false;
    });

    it('should return true when a component matches a transport', () => {
      const pipeline = new TransportPipeline([createMockTransport('herokuCompute', 'before-metadata')]);

      const apexClass = createMockComponent('PlatformComputeApp', 'MyApp');

      expect(pipeline.hasTransports([apexClass])).to.be.true;
    });
  });

  describe('explain', () => {
    it('should produce a plan with correct phase ordering', () => {
      const pipeline = new TransportPipeline([createMockTransport('herokuCompute', 'before-metadata')]);

      const apexClass = createMockComponent('PlatformComputeApp', 'MyApp');
      const customObject = createMockComponent('CustomObject', 'MyObject__c');
      const apexTrigger = createMockComponent('ApexTrigger', 'MyTrigger');

      const plan = pipeline.explain([apexClass, customObject, apexTrigger]);

      expect(plan.phases).to.have.lengthOf(2);
      expect(plan.phases[0].phase).to.equal('before-metadata');
      expect(plan.phases[0].label).to.equal('Mock herokuCompute');
      expect(plan.phases[1].phase).to.equal('metadata-api');
      expect(plan.phases[1].components).to.have.lengthOf(3);
    });

    it('should produce metadata-only plan when no transports match', () => {
      const pipeline = new TransportPipeline();
      const apexClass = createMockComponent('ApexClass', 'MyClass');

      const plan = pipeline.explain([apexClass]);

      expect(plan.phases).to.have.lengthOf(1);
      expect(plan.phases[0].phase).to.equal('metadata-api');
    });
  });

  describe('runBeforeMetadata / runAfterMetadata', () => {
    const mockContext: TransportContext = {
      components: [],
      connection: {} as Connection,
      project: {} as SfProject,
      orgId: '00Dxx0000000000',
    };

    it('should run only before-metadata transports in runBeforeMetadata', async () => {
      const beforeResponse: FileResponse = {
        fullName: 'MyApp',
        type: 'PlatformComputeApp',
        state: ComponentStatus.Changed,
        filePath: 'force-app/main/default/compute/MyApp/main.py',
      };
      const beforeTransport = createMockTransport('connectApi', 'before-metadata', [beforeResponse]);
      const afterTransport = createMockTransport('datakitApi', 'after-metadata');
      const pipeline = new TransportPipeline([beforeTransport, afterTransport]);

      const groups = [
        { transport: beforeTransport, components: [createMockComponent('ApexClass', 'MyClass')] },
        { transport: afterTransport, components: [createMockComponent('CustomObject', 'MyObject__c')] },
      ];

      const result = await pipeline.runBeforeMetadata(mockContext, groups);

      expect(result.fileResponses).to.have.lengthOf(1);
      expect(result.fileResponses[0].fullName).to.equal('MyApp');
      expect(result.asyncHandles).to.have.lengthOf(0);
    });

    it('should run only after-metadata transports in runAfterMetadata', async () => {
      const afterResponse: FileResponse = {
        fullName: 'CustomerDataKit',
        type: 'DataPackageDefinition',
        state: ComponentStatus.Changed,
        filePath: 'force-app/main/default/datapkg/CustomerDataKit.json',
      };
      const beforeTransport = createMockTransport('connectApi', 'before-metadata');
      const afterTransport = createMockTransport('datakitApi', 'after-metadata', [afterResponse]);
      const pipeline = new TransportPipeline([beforeTransport, afterTransport]);

      const groups = [
        { transport: beforeTransport, components: [createMockComponent('ApexClass', 'MyClass')] },
        { transport: afterTransport, components: [createMockComponent('CustomObject', 'MyObject__c')] },
      ];

      const result = await pipeline.runAfterMetadata(mockContext, groups);

      expect(result.fileResponses).to.have.lengthOf(1);
      expect(result.fileResponses[0].fullName).to.equal('CustomerDataKit');
    });

    it('should use retrieve phase ordering when operation is retrieve', async () => {
      const retrieveResponse: FileResponse = {
        fullName: 'MyApp',
        type: 'PlatformComputeApp',
        state: ComponentStatus.Changed,
        filePath: 'force-app/main/default/compute/MyApp/main.py',
      };
      // deploy: before-metadata → retrieve: after-metadata (flipped by createMockTransport)
      const transport = createMockTransport('connectApi', 'before-metadata');
      // override retrieve to return responses
      transport.afterRetrieve = async (): Promise<TransportResult> => ({ fileResponses: [retrieveResponse] });
      const pipeline = new TransportPipeline([transport]);

      const groups = [{ transport, components: [createMockComponent('ApexClass', 'MyClass')] }];

      // for deploy, this transport is before-metadata → runAfterMetadata should skip it
      const deployResult = await pipeline.runAfterMetadata(mockContext, groups, 'deploy');
      expect(deployResult.fileResponses).to.have.lengthOf(0);

      // for retrieve, this transport is after-metadata → runAfterMetadata should run it
      const retrieveResult = await pipeline.runAfterMetadata(mockContext, groups, 'retrieve');
      expect(retrieveResult.fileResponses).to.have.lengthOf(1);
      expect(retrieveResult.fileResponses[0].fullName).to.equal('MyApp');
    });

    it('should produce correct explain plan for retrieve operation', () => {
      const transport = createMockTransport('herokuCompute', 'before-metadata');
      transport.afterRetrieve = async (): Promise<TransportResult> => ({ fileResponses: [] });
      const pipeline = new TransportPipeline([transport]);

      const apexClass = createMockComponent('PlatformComputeApp', 'MyApp');
      const customObject = createMockComponent('CustomObject', 'MyObject__c');

      const deployPlan = pipeline.explain([apexClass, customObject], 'deploy');
      const retrievePlan = pipeline.explain([apexClass, customObject], 'retrieve');

      // deploy: herokuCompute is before metadata.
      expect(deployPlan.phases[0].phase).to.equal('before-metadata');
      expect(deployPlan.phases[0].label).to.equal('Mock herokuCompute');

      // retrieve: herokuCompute is after metadata.
      expect(retrievePlan.phases[0].phase).to.equal('metadata-api');
      expect(retrievePlan.phases[1].phase).to.equal('after-metadata');
      expect(retrievePlan.phases[1].label).to.equal('Mock herokuCompute');
    });

    it('should collect async handles from transports', async () => {
      const asyncTransport: TransportProvider = {
        name: 'herokuCompute',
        describe: () => ({ label: 'Connect API', endpoint: '/connect/compute' }),
        handles: () => true,
        beforeDeploy: async () => ({
          fileResponses: [],
          asyncResult: {
            transportName: 'herokuCompute',
            status: 'Pending' as const,
            message: 'Deploy extension pending',
            checkStatus: async (): Promise<AsyncTransportHandle> => ({
              transportName: 'herokuCompute',
              status: 'Succeeded' as const,
              checkStatus: async (): Promise<AsyncTransportHandle> => ({} as unknown as AsyncTransportHandle),
            }),
          },
        }),
      };
      const pipeline = new TransportPipeline([asyncTransport]);

      const groups = [{ transport: asyncTransport, components: [createMockComponent('ApexClass', 'MyClass')] }];

      const result = await pipeline.runBeforeMetadata(mockContext, groups);

      expect(result.asyncHandles).to.have.lengthOf(1);
      expect(result.asyncHandles[0].transportName).to.equal('herokuCompute');
      expect(result.asyncHandles[0].status).to.equal('Pending');
    });
  });
});
