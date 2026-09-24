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
import {
  AsyncTransportHandle,
  ComponentStatus,
  DeployPipeline,
  FileResponse,
  RegistryAccess,
  SourceComponent,
  TransportContext,
  TransportDescription,
  TransportPhase,
  TransportProvider,
  TransportResult,
} from '../../../src';

const registryAccess = new RegistryAccess();

function createMockTransport(
  name: string,
  deployPhase: TransportPhase,
  typeNames: string[],
  fileResponses: FileResponse[] = []
): TransportProvider {
  const retrievePhase: TransportPhase = deployPhase === 'before-metadata' ? 'after-metadata' : 'before-metadata';
  return {
    name,
    phase: { deploy: deployPhase, retrieve: retrievePhase },
    describe(): TransportDescription {
      return { label: `Mock ${name}`, endpoint: `https://example.com/${name}` };
    },
    handles(component: SourceComponent): boolean {
      return typeNames.includes(component.type.name);
    },
    async deploy(): Promise<TransportResult> {
      return { fileResponses };
    },
    async retrieve(): Promise<TransportResult> {
      return { fileResponses: [] };
    },
  };
}

function createMockComponent(typeName: string, fullName: string): SourceComponent {
  const type = registryAccess.getTypeByName(typeName);
  return new SourceComponent({ name: fullName, type });
}

describe('DeployPipeline', () => {
  describe('groupByTransport', () => {
    it('should put all components in metadataApi when no transports registered', () => {
      const pipeline = new DeployPipeline();
      const apexClass = createMockComponent('ApexClass', 'MyClass');
      const customObject = createMockComponent('CustomObject', 'MyObject__c');

      const result = pipeline.groupByTransport([apexClass, customObject]);

      expect(result.metadataApi).to.have.lengthOf(2);
      expect(result.transports).to.have.lengthOf(0);
    });

    it('should group components by transport when transports are registered', () => {
      const pipeline = new DeployPipeline();
      const mockTransport = createMockTransport('connectApi', 'before-metadata', ['ApexClass']);
      pipeline.registerTransport(mockTransport);

      const apexClass = createMockComponent('ApexClass', 'MyClass');
      const customObject = createMockComponent('CustomObject', 'MyObject__c');

      const result = pipeline.groupByTransport([apexClass, customObject]);

      // all components go through metadata api
      expect(result.metadataApi).to.have.lengthOf(2);
      // ApexClass also goes through transport
      expect(result.transports).to.have.lengthOf(1);
      expect(result.transports[0].transport.name).to.equal('connectApi');
      expect(result.transports[0].components).to.have.lengthOf(1);
      expect(result.transports[0].components[0].fullName).to.equal('MyClass');
    });

    it('should handle multiple transports', () => {
      const pipeline = new DeployPipeline();
      pipeline.registerTransport(createMockTransport('connectApi', 'before-metadata', ['ApexClass']));
      pipeline.registerTransport(createMockTransport('datakitApi', 'after-metadata', ['CustomObject']));

      const apexClass = createMockComponent('ApexClass', 'MyClass');
      const customObject = createMockComponent('CustomObject', 'MyObject__c');
      const apexTrigger = createMockComponent('ApexTrigger', 'MyTrigger');

      const result = pipeline.groupByTransport([apexClass, customObject, apexTrigger]);

      expect(result.metadataApi).to.have.lengthOf(3);
      expect(result.transports).to.have.lengthOf(2);

      const connectGroup = result.transports.find((t) => t.transport.name === 'connectApi');
      const datakitGroup = result.transports.find((t) => t.transport.name === 'datakitApi');

      expect(connectGroup?.components).to.have.lengthOf(1);
      expect(datakitGroup?.components).to.have.lengthOf(1);
    });
  });

  describe('hasTransports', () => {
    it('should return false when no transports registered', () => {
      const pipeline = new DeployPipeline();
      const apexClass = createMockComponent('ApexClass', 'MyClass');

      expect(pipeline.hasTransports([apexClass])).to.be.false;
    });

    it('should return false when no components match a transport', () => {
      const pipeline = new DeployPipeline();
      pipeline.registerTransport(createMockTransport('connectApi', 'before-metadata', ['CustomObject']));

      const apexClass = createMockComponent('ApexClass', 'MyClass');

      expect(pipeline.hasTransports([apexClass])).to.be.false;
    });

    it('should return true when a component matches a transport', () => {
      const pipeline = new DeployPipeline();
      pipeline.registerTransport(createMockTransport('connectApi', 'before-metadata', ['ApexClass']));

      const apexClass = createMockComponent('ApexClass', 'MyClass');

      expect(pipeline.hasTransports([apexClass])).to.be.true;
    });

    it('should return false when matching type is in skipTypes', () => {
      const pipeline = new DeployPipeline();
      pipeline.registerTransport(createMockTransport('connectApi', 'before-metadata', ['ApexClass']));

      const apexClass = createMockComponent('ApexClass', 'MyClass');

      expect(pipeline.hasTransports([apexClass], ['ApexClass'])).to.be.false;
    });
  });

  describe('skipTypes', () => {
    it('should exclude skipped types from transport groups', () => {
      const pipeline = new DeployPipeline();
      pipeline.registerTransport(createMockTransport('connectApi', 'before-metadata', ['ApexClass']));
      pipeline.registerTransport(createMockTransport('datakitApi', 'after-metadata', ['CustomObject']));

      const apexClass = createMockComponent('ApexClass', 'MyClass');
      const customObject = createMockComponent('CustomObject', 'MyObject__c');

      const result = pipeline.groupByTransport([apexClass, customObject], ['ApexClass']);

      // all components still go through metadata api
      expect(result.metadataApi).to.have.lengthOf(2);
      // only CustomObject transport remains
      expect(result.transports).to.have.lengthOf(1);
      expect(result.transports[0].transport.name).to.equal('datakitApi');
    });

    it('should exclude skipped types from explain plan', () => {
      const pipeline = new DeployPipeline();
      pipeline.registerTransport(createMockTransport('connectApi', 'before-metadata', ['ApexClass']));
      pipeline.registerTransport(createMockTransport('datakitApi', 'after-metadata', ['CustomObject']));

      const apexClass = createMockComponent('ApexClass', 'MyClass');
      const customObject = createMockComponent('CustomObject', 'MyObject__c');

      const plan = pipeline.explain([apexClass, customObject], 'deploy', ['ApexClass']);

      // before-metadata phase for connectApi is gone, only metadata-api + after-metadata remain
      expect(plan.phases).to.have.lengthOf(2);
      expect(plan.phases[0].phase).to.equal('metadata-api');
      expect(plan.phases[1].phase).to.equal('after-metadata');
    });
  });

  describe('explain', () => {
    it('should produce a plan with correct phase ordering', () => {
      const pipeline = new DeployPipeline();
      pipeline.registerTransport(createMockTransport('connectApi', 'before-metadata', ['ApexClass']));
      pipeline.registerTransport(createMockTransport('datakitApi', 'after-metadata', ['CustomObject']));

      const apexClass = createMockComponent('ApexClass', 'MyClass');
      const customObject = createMockComponent('CustomObject', 'MyObject__c');
      const apexTrigger = createMockComponent('ApexTrigger', 'MyTrigger');

      const plan = pipeline.explain([apexClass, customObject, apexTrigger]);

      expect(plan.phases).to.have.lengthOf(3);
      expect(plan.phases[0].phase).to.equal('before-metadata');
      expect(plan.phases[0].label).to.equal('Mock connectApi');
      expect(plan.phases[1].phase).to.equal('metadata-api');
      expect(plan.phases[1].components).to.have.lengthOf(3);
      expect(plan.phases[2].phase).to.equal('after-metadata');
      expect(plan.phases[2].label).to.equal('Mock datakitApi');
    });

    it('should produce metadata-only plan when no transports match', () => {
      const pipeline = new DeployPipeline();
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
      const pipeline = new DeployPipeline();
      const beforeResponse: FileResponse = {
        fullName: 'MyApp',
        type: 'PlatformComputeApp',
        state: ComponentStatus.Changed,
        filePath: 'force-app/main/default/compute/MyApp/main.py',
      };
      const beforeTransport = createMockTransport('connectApi', 'before-metadata', ['ApexClass'], [beforeResponse]);
      const afterTransport = createMockTransport('datakitApi', 'after-metadata', ['CustomObject']);
      pipeline.registerTransport(beforeTransport);
      pipeline.registerTransport(afterTransport);

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
      const pipeline = new DeployPipeline();
      const afterResponse: FileResponse = {
        fullName: 'CustomerDataKit',
        type: 'DataPackageDefinition',
        state: ComponentStatus.Changed,
        filePath: 'force-app/main/default/datapkg/CustomerDataKit.json',
      };
      const beforeTransport = createMockTransport('connectApi', 'before-metadata', ['ApexClass']);
      const afterTransport = createMockTransport('datakitApi', 'after-metadata', ['CustomObject'], [afterResponse]);
      pipeline.registerTransport(beforeTransport);
      pipeline.registerTransport(afterTransport);

      const groups = [
        { transport: beforeTransport, components: [createMockComponent('ApexClass', 'MyClass')] },
        { transport: afterTransport, components: [createMockComponent('CustomObject', 'MyObject__c')] },
      ];

      const result = await pipeline.runAfterMetadata(mockContext, groups);

      expect(result.fileResponses).to.have.lengthOf(1);
      expect(result.fileResponses[0].fullName).to.equal('CustomerDataKit');
    });

    it('should collect async handles from transports', async () => {
      const pipeline = new DeployPipeline();
      const asyncTransport: TransportProvider = {
        name: 'connectApi',
        phase: { deploy: 'before-metadata', retrieve: 'after-metadata' },
        describe: () => ({ label: 'Connect API', endpoint: '/connect/compute' }),
        handles: () => true,
        deploy: async () => ({
          fileResponses: [],
          asyncResult: {
            transportName: 'connectApi',
            status: 'Pending' as const,
            message: 'Deploy extension pending',
            checkStatus: async (): Promise<AsyncTransportHandle> => ({
              transportName: 'connectApi',
              status: 'Succeeded' as const,
              checkStatus: async (): Promise<AsyncTransportHandle> => ({} as unknown as AsyncTransportHandle),
            }),
          },
        }),
        retrieve: async () => ({ fileResponses: [] }),
      };
      pipeline.registerTransport(asyncTransport);

      const groups = [{ transport: asyncTransport, components: [createMockComponent('ApexClass', 'MyClass')] }];

      const result = await pipeline.runBeforeMetadata(mockContext, groups);

      expect(result.asyncHandles).to.have.lengthOf(1);
      expect(result.asyncHandles[0].transportName).to.equal('connectApi');
      expect(result.asyncHandles[0].status).to.equal('Pending');
    });
  });
});
