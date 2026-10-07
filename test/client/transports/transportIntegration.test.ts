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
import * as sinon from 'sinon';
import { Connection, SfProject } from '@salesforce/core';
import {
  ComponentSet,
  ComponentStatus,
  FileResponse,
  MetadataApiRetrieveStatus,
  RegistryAccess,
  RequestStatus,
  RetrieveResult,
  SourceComponent,
} from '../../../src';
import { TransportPipeline } from '../../../src/client/transports/transportPipeline';
import {
  TransportContext,
  TransportDescription,
  TransportProvider,
  TransportResult,
} from '../../../src/client/transports/types';

const registryAccess = new RegistryAccess();

function createMockTransport(overrides: {
  name?: 'herokuCompute';
  deployPhase: 'before-metadata' | 'after-metadata';
  retrievePhase: 'before-metadata' | 'after-metadata';
  typeNames: string[];
  deployResponses?: FileResponse[];
  retrieveResponses?: FileResponse[];
  deploySpy?: sinon.SinonSpy;
  retrieveSpy?: sinon.SinonSpy;
  shouldThrow?: 'deploy' | 'retrieve';
}): TransportProvider {
  const transport: TransportProvider = {
    name: overrides.name ?? 'herokuCompute',
    describe(): TransportDescription {
      return { label: 'Mock transport', endpoint: 'https://example.com/transport' };
    },
    handles(component: SourceComponent): boolean {
      return overrides.typeNames.includes(component.type.name);
    },
  };
  const deploy = async (ctx: TransportContext): Promise<TransportResult> => {
    overrides.deploySpy?.(ctx);
    if (overrides.shouldThrow === 'deploy') throw new Error('deploy transport failed');
    return { fileResponses: overrides.deployResponses ?? [] };
  };
  const retrieve = async (ctx: TransportContext): Promise<TransportResult> => {
    overrides.retrieveSpy?.(ctx);
    if (overrides.shouldThrow === 'retrieve') throw new Error('retrieve transport failed');
    return { fileResponses: overrides.retrieveResponses ?? [] };
  };
  if (overrides.deployPhase === 'before-metadata') transport.beforeDeploy = deploy;
  else transport.afterDeploy = deploy;
  if (overrides.retrievePhase === 'before-metadata') transport.beforeRetrieve = retrieve;
  else transport.afterRetrieve = retrieve;
  return transport;
}

function createMockComponent(typeName: string, fullName: string): SourceComponent {
  const type = {
    ...registryAccess.getTypeByName(typeName),
    strategies: { adapter: 'default' as const, transport: 'herokuCompute' as const },
  };
  return new SourceComponent({ name: fullName, type });
}

function createRetrieveStatus(overrides: Partial<MetadataApiRetrieveStatus> = {}): MetadataApiRetrieveStatus {
  return {
    id: '09S000000000000',
    status: RequestStatus.Succeeded,
    success: true,
    done: true,
    fileProperties: [],
    zipFile: '',
    ...overrides,
  };
}

const mockContext: TransportContext = {
  components: [],
  connection: {} as Connection,
  project: {} as SfProject,
  orgId: '00Dxx0000000000',
};

describe('Transport integration', () => {
  afterEach(() => sinon.restore());

  describe('retrieve before-metadata transports', () => {
    it('should run before-metadata retrieve transports via runBeforeMetadata', async () => {
      const retrieveSpy = sinon.spy();
      const retrieveResponse: FileResponse = {
        fullName: 'PreRetrieveApp',
        type: 'CustomObject',
        state: ComponentStatus.Changed,
        filePath: 'force-app/main/default/objects/PreRetrieveApp.object-meta.xml',
      };
      const transport = createMockTransport({
        deployPhase: 'after-metadata',
        retrievePhase: 'before-metadata',
        typeNames: ['CustomObject'],
        retrieveResponses: [retrieveResponse],
        retrieveSpy,
      });

      const pipeline = new TransportPipeline([transport]);

      const groups = [{ transport, components: [createMockComponent('CustomObject', 'MyObject__c')] }];

      const result = await pipeline.runBeforeMetadata(mockContext, groups, 'retrieve');

      expect(retrieveSpy.calledOnce).to.be.true;
      expect(result.fileResponses).to.have.lengthOf(1);
      expect(result.fileResponses[0].fullName).to.equal('PreRetrieveApp');
    });

    it('should not run after-metadata retrieve transports in runBeforeMetadata', async () => {
      const retrieveSpy = sinon.spy();
      const transport = createMockTransport({
        deployPhase: 'before-metadata',
        retrievePhase: 'after-metadata',
        typeNames: ['ApexClass'],
        retrieveSpy,
      });

      const pipeline = new TransportPipeline([transport]);

      const groups = [{ transport, components: [createMockComponent('ApexClass', 'MyClass')] }];

      const result = await pipeline.runBeforeMetadata(mockContext, groups, 'retrieve');

      expect(retrieveSpy.called).to.be.false;
      expect(result.fileResponses).to.have.lengthOf(0);
    });
  });

  describe('transport failure handling', () => {
    it('should propagate transport errors from runAfterMetadata for callers to catch', async () => {
      const transport = createMockTransport({
        deployPhase: 'before-metadata',
        retrievePhase: 'after-metadata',
        typeNames: ['ApexClass'],
        shouldThrow: 'retrieve',
      });

      const pipeline = new TransportPipeline([transport]);

      const groups = [{ transport, components: [createMockComponent('ApexClass', 'MyClass')] }];

      try {
        await pipeline.runAfterMetadata(mockContext, groups, 'retrieve');
        expect.fail('should have thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('retrieve transport failed');
      }
    });

    it('should propagate transport errors from runBeforeMetadata for callers to catch', async () => {
      const transport = createMockTransport({
        deployPhase: 'before-metadata',
        retrievePhase: 'after-metadata',
        typeNames: ['ApexClass'],
        shouldThrow: 'deploy',
      });

      const pipeline = new TransportPipeline([transport]);

      const groups = [{ transport, components: [createMockComponent('ApexClass', 'MyClass')] }];

      try {
        await pipeline.runBeforeMetadata(mockContext, groups, 'deploy');
        expect.fail('should have thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('deploy transport failed');
      }
    });
  });

  describe('ComponentSet auto-discovery', () => {
    it('should auto-discover builtin transports for PlatformComputeApp', () => {
      const computeType = registryAccess.getTypeByName('PlatformComputeApp');
      const component = new SourceComponent({ name: 'MyApp', type: computeType, content: '/mock/app' });
      const cs = new ComponentSet([component]);

      expect(cs.transportPipeline).to.not.be.undefined;
      expect(cs.transportPipeline!.hasTransports([component])).to.be.true;
    });

    it('should not create a pipeline when no transport-eligible types exist', () => {
      const apexType = registryAccess.getTypeByName('ApexClass');
      const component = new SourceComponent({ name: 'MyClass', type: apexType });
      const cs = new ComponentSet([component]);

      expect(cs.transportPipeline).to.be.undefined;
    });

    it('should re-evaluate when transport-eligible component is added after first access', () => {
      const apexType = registryAccess.getTypeByName('ApexClass');
      const cs = new ComponentSet([new SourceComponent({ name: 'MyClass', type: apexType })]);

      expect(cs.transportPipeline).to.be.undefined;

      const computeType = registryAccess.getTypeByName('PlatformComputeApp');
      const computeComp = new SourceComponent({ name: 'MyApp', type: computeType, content: '/mock/app' });
      cs.add(computeComp);

      expect(cs.transportPipeline).to.not.be.undefined;
      expect(cs.transportPipeline!.hasTransports([computeComp])).to.be.true;
    });

    it('should allow explicit pipeline to override auto-discovery', () => {
      const computeType = registryAccess.getTypeByName('PlatformComputeApp');
      const component = new SourceComponent({ name: 'MyApp', type: computeType, content: '/mock/app' });
      const cs = new ComponentSet([component]);

      const customPipeline = new TransportPipeline();
      cs.transportPipeline = customPipeline;

      expect(cs.transportPipeline).to.equal(customPipeline);
      expect(() => cs.transportPipeline?.hasTransports([component])).to.throw('No transport provider is registered');
    });
  });

  describe('RetrieveResult deduplication', () => {
    it('should deduplicate identical transport responses', () => {
      const result = new RetrieveResult(createRetrieveStatus(), new ComponentSet());

      const response: FileResponse = {
        fullName: 'MyApp',
        type: 'PlatformComputeApp',
        state: ComponentStatus.Changed,
        filePath: 'force-app/main/default/compute/MyApp/main.py',
      };

      result.addTransportResults([response, response]);

      const fileResponses = result.getFileResponses();
      expect(fileResponses).to.have.lengthOf(1);
    });

    it('should keep distinct transport responses', () => {
      const result = new RetrieveResult(createRetrieveStatus(), new ComponentSet());

      result.addTransportResults([
        {
          fullName: 'App1',
          type: 'PlatformComputeApp',
          state: ComponentStatus.Changed,
          filePath: 'force-app/main/default/compute/App1/main.py',
        },
        {
          fullName: 'App2',
          type: 'PlatformComputeApp',
          state: ComponentStatus.Created,
          filePath: 'force-app/main/default/compute/App2/main.py',
        },
      ]);

      const fileResponses = result.getFileResponses();
      expect(fileResponses).to.have.lengthOf(2);
    });
  });
});
