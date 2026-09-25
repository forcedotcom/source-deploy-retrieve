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
  TransportContext,
  TransportDescription,
  TransportPhase,
  TransportPipeline,
  TransportProvider,
  TransportResult,
} from '../../../src';

const registryAccess = new RegistryAccess();

function createMockTransport(overrides: {
  name: string;
  deployPhase: TransportPhase;
  retrievePhase: TransportPhase;
  typeNames: string[];
  deployResponses?: FileResponse[];
  retrieveResponses?: FileResponse[];
  deploySpy?: sinon.SinonSpy;
  retrieveSpy?: sinon.SinonSpy;
  shouldThrow?: 'deploy' | 'retrieve';
}): TransportProvider {
  return {
    name: overrides.name,
    phase: { deploy: overrides.deployPhase, retrieve: overrides.retrievePhase },
    describe(): TransportDescription {
      return { label: `Mock ${overrides.name}`, endpoint: `https://example.com/${overrides.name}` };
    },
    handles(component: SourceComponent): boolean {
      return overrides.typeNames.includes(component.type.name);
    },
    async deploy(ctx: TransportContext): Promise<TransportResult> {
      overrides.deploySpy?.(ctx);
      if (overrides.shouldThrow === 'deploy') throw new Error('deploy transport failed');
      return { fileResponses: overrides.deployResponses ?? [] };
    },
    async retrieve(ctx: TransportContext): Promise<TransportResult> {
      overrides.retrieveSpy?.(ctx);
      if (overrides.shouldThrow === 'retrieve') throw new Error('retrieve transport failed');
      return { fileResponses: overrides.retrieveResponses ?? [] };
    },
  };
}

function createMockComponent(typeName: string, fullName: string): SourceComponent {
  const type = registryAccess.getTypeByName(typeName);
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
        name: 'datakitApi',
        deployPhase: 'after-metadata',
        retrievePhase: 'before-metadata',
        typeNames: ['CustomObject'],
        retrieveResponses: [retrieveResponse],
        retrieveSpy,
      });

      const pipeline = new TransportPipeline();
      pipeline.registerTransport(transport);

      const groups = [{ transport, components: [createMockComponent('CustomObject', 'MyObject__c')] }];

      const result = await pipeline.runBeforeMetadata(mockContext, groups, 'retrieve');

      expect(retrieveSpy.calledOnce).to.be.true;
      expect(result.fileResponses).to.have.lengthOf(1);
      expect(result.fileResponses[0].fullName).to.equal('PreRetrieveApp');
    });

    it('should not run after-metadata retrieve transports in runBeforeMetadata', async () => {
      const retrieveSpy = sinon.spy();
      const transport = createMockTransport({
        name: 'connectApi',
        deployPhase: 'before-metadata',
        retrievePhase: 'after-metadata',
        typeNames: ['ApexClass'],
        retrieveSpy,
      });

      const pipeline = new TransportPipeline();
      pipeline.registerTransport(transport);

      const groups = [{ transport, components: [createMockComponent('ApexClass', 'MyClass')] }];

      const result = await pipeline.runBeforeMetadata(mockContext, groups, 'retrieve');

      expect(retrieveSpy.called).to.be.false;
      expect(result.fileResponses).to.have.lengthOf(0);
    });
  });

  describe('transport failure handling', () => {
    it('should propagate transport errors from runAfterMetadata for callers to catch', async () => {
      const transport = createMockTransport({
        name: 'connectApi',
        deployPhase: 'before-metadata',
        retrievePhase: 'after-metadata',
        typeNames: ['ApexClass'],
        shouldThrow: 'retrieve',
      });

      const pipeline = new TransportPipeline();
      pipeline.registerTransport(transport);

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
        name: 'connectApi',
        deployPhase: 'before-metadata',
        retrievePhase: 'after-metadata',
        typeNames: ['ApexClass'],
        shouldThrow: 'deploy',
      });

      const pipeline = new TransportPipeline();
      pipeline.registerTransport(transport);

      const groups = [{ transport, components: [createMockComponent('ApexClass', 'MyClass')] }];

      try {
        await pipeline.runBeforeMetadata(mockContext, groups, 'deploy');
        expect.fail('should have thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('deploy transport failed');
      }
    });
  });

  describe('skipTransports with retrieve', () => {
    it('should exclude skipped types from retrieve explain plan', () => {
      const pipeline = new TransportPipeline();
      pipeline.registerTransport(
        createMockTransport({
          name: 'connectApi',
          deployPhase: 'before-metadata',
          retrievePhase: 'after-metadata',
          typeNames: ['ApexClass'],
        })
      );

      const apexClass = createMockComponent('ApexClass', 'MyClass');

      const planWithout = pipeline.explain([apexClass], 'retrieve');
      const planWith = pipeline.explain([apexClass], 'retrieve', ['ApexClass']);

      expect(planWithout.phases).to.have.lengthOf(2);
      expect(planWith.phases).to.have.lengthOf(1);
      expect(planWith.phases[0].phase).to.equal('metadata-api');
    });

    it('should exclude skipped types from groupByTransport but keep in metadataApi', () => {
      const pipeline = new TransportPipeline();
      pipeline.registerTransport(
        createMockTransport({
          name: 'connectApi',
          deployPhase: 'before-metadata',
          retrievePhase: 'after-metadata',
          typeNames: ['ApexClass', 'ApexTrigger'],
        })
      );

      const apexClass = createMockComponent('ApexClass', 'MyClass');
      const apexTrigger = createMockComponent('ApexTrigger', 'MyTrigger');

      const result = pipeline.groupByTransport([apexClass, apexTrigger], ['ApexClass']);

      expect(result.metadataApi).to.have.lengthOf(2);
      expect(result.transports).to.have.lengthOf(1);
      expect(result.transports[0].components).to.have.lengthOf(1);
      expect(result.transports[0].components[0].type.name).to.equal('ApexTrigger');
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
