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
import { MetadataApiRetrieve } from '../../../src/client/metadataApiRetrieve';
import { MetadataApiDeploy } from '../../../src/client/metadataApiDeploy';
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

  describe('ComponentSet transport selection', () => {
    const connection = { getAuthInfoFields: () => ({ orgId: '00D' }) } as Connection;
    const project = {} as SfProject;

    beforeEach(() => {
      sinon.stub(SfProject, 'resolve').resolves(project);
      sinon.stub(MetadataApiRetrieve.prototype, 'start').resolves({ id: 'retrieve' });
      sinon.stub(MetadataApiDeploy.prototype, 'start').resolves({ id: 'deploy' });
    });

    it('preserves both source locations for the same metadata member when grouping', async () => {
      const type = registryAccess.getTypeByName('PlatformComputeApp');
      const first = new SourceComponent({ name: 'SharedApp', type, content: '/first/SharedApp' });
      const second = new SourceComponent({ name: 'SharedApp', type, content: '/second/SharedApp' });
      const set = new ComponentSet([{ fullName: 'SharedApp', type }, first, second]);
      const pipeline = new TransportPipeline([
        createMockTransport({
          deployPhase: 'before-metadata',
          retrievePhase: 'after-metadata',
          typeNames: ['PlatformComputeApp'],
        }),
      ]);
      set.transportPipeline = pipeline;
      const group = sinon.spy(pipeline, 'groupByTransport');

      await set.retrieve({ output: '/out', usernameOrConnection: connection });

      expect(group.firstCall.returnValue.transports[0].components).to.deep.equal([first, second]);
    });

    it('selects both local and manifest-only members and prefers content for duplicates without changing MDAPI members', async () => {
      const type = registryAccess.getTypeByName('PlatformComputeApp');
      const local = new SourceComponent({ name: 'LocalApp', type, content: '/local/app' });
      const set = new ComponentSet();
      set.add({ fullName: 'LocalApp', type });
      set.add({ fullName: 'RemoteApp', type });
      set.add(local);
      const pipeline = new TransportPipeline([
        createMockTransport({
          deployPhase: 'before-metadata',
          retrievePhase: 'after-metadata',
          typeNames: ['PlatformComputeApp'],
        }),
      ]);
      set.transportPipeline = pipeline;
      const group = sinon.spy(pipeline, 'groupByTransport');
      expect((await set.getObject()).Package.types).to.deep.include({
        name: 'PlatformComputeApp',
        members: ['LocalApp', 'RemoteApp'],
      });

      await set.retrieve({ output: '/out', usernameOrConnection: connection });

      expect(group.calledOnce).to.be.true;
      const grouped = group.firstCall.returnValue.transports[0].components;
      expect(grouped.map((c) => c.fullName)).to.have.members(['LocalApp', 'RemoteApp']);
      expect(grouped).to.have.lengthOf(2);
      expect(grouped.find((c) => c.fullName === 'LocalApp')).to.equal(local);
      expect(grouped.find((c) => c.fullName === 'RemoteApp')?.content).to.be.undefined;
      expect((await set.getObject()).Package.types).to.deep.include({
        name: 'PlatformComputeApp',
        members: ['LocalApp', 'RemoteApp'],
      });
    });

    it('skips transport by metadata type while retaining all MDAPI members', async () => {
      const type = registryAccess.getTypeByName('PlatformComputeApp');
      const set = new ComponentSet([new SourceComponent({ name: 'MyApp', type, content: '/local/app' })]);
      const pipeline = new TransportPipeline([
        createMockTransport({
          deployPhase: 'before-metadata',
          retrievePhase: 'after-metadata',
          typeNames: ['PlatformComputeApp'],
        }),
      ]);
      set.transportPipeline = pipeline;
      const group = sinon.spy(pipeline, 'groupByTransport');
      const run = sinon.spy(pipeline, 'runBeforeMetadata');

      const result = await set.retrieve({
        output: '/out',
        usernameOrConnection: connection,
        skipTransports: ['PlatformComputeApp'],
      });

      expect(group.called).to.be.false;
      expect(run.called).to.be.false;
      expect((await set.getObject()).Package.types).to.deep.include({ name: 'PlatformComputeApp', members: ['MyApp'] });
      expect(result).to.be.instanceOf(MetadataApiRetrieve);
    });

    it('does not activate a skipped provider when other metadata types remain', async () => {
      const compute = registryAccess.getTypeByName('PlatformComputeApp');
      const apex = registryAccess.getTypeByName('ApexClass');
      const set = new ComponentSet([
        new SourceComponent({ name: 'MyApp', type: compute }),
        new SourceComponent({ name: 'MyClass', type: apex }),
      ]);
      const pipeline = new TransportPipeline();
      set.transportPipeline = pipeline;
      const group = sinon.spy(pipeline, 'groupByTransport');
      await set.retrieve({ output: '/out', usernameOrConnection: connection, skipTransports: ['PlatformComputeApp'] });
      expect(group.called).to.be.false;
      expect((await set.getObject()).Package.types).to.deep.include({ name: 'PlatformComputeApp', members: ['MyApp'] });
    });

    it('does not construct a builtin pipeline for skipped transport types alongside regular metadata', async () => {
      const compute = registryAccess.getTypeByName('PlatformComputeApp');
      const apex = registryAccess.getTypeByName('ApexClass');
      const set = new ComponentSet([
        new SourceComponent({ name: 'MyApp', type: compute }),
        new SourceComponent({ name: 'MyClass', type: apex }),
      ]);
      const builtin = sinon.spy(TransportPipeline, 'withBuiltinTransports');

      await set.retrieve({ output: '/out', usernameOrConnection: connection, skipTransports: ['PlatformComputeApp'] });

      expect(builtin.called).to.be.false;
    });

    it('does not run a secondary transport for metadata format', async () => {
      const type = registryAccess.getTypeByName('PlatformComputeApp');
      const set = new ComponentSet([new SourceComponent({ name: 'MyApp', type, content: '/local/app' })]);
      const pipeline = new TransportPipeline();
      set.transportPipeline = pipeline;
      await set.retrieve({ output: '/out', format: 'metadata', usernameOrConnection: connection });
      expect((await set.getObject()).Package.types).to.deep.include({ name: 'PlatformComputeApp', members: ['MyApp'] });
    });

    it('does not run a secondary transport for checkOnly but still starts MDAPI with that option', async () => {
      const type = registryAccess.getTypeByName('PlatformComputeApp');
      const set = new ComponentSet([new SourceComponent({ name: 'MyApp', type, content: '/local/app' })]);
      const pipeline = new TransportPipeline();
      set.transportPipeline = pipeline;
      const result = await set.deploy({ usernameOrConnection: connection, apiOptions: { checkOnly: true } });
      expect(result).to.be.instanceOf(MetadataApiDeploy);
      expect((result as unknown as { options: { apiOptions: { checkOnly: boolean } } }).options.apiOptions.checkOnly).to
        .be.true;
    });

    it('passes explicit output as the source fallback for manifest-only retrieve', async () => {
      const type = registryAccess.getTypeByName('PlatformComputeApp');
      const set = new ComponentSet();
      set.add({ fullName: 'RemoteApp', type });
      const pipeline = new TransportPipeline([
        createMockTransport({
          deployPhase: 'before-metadata',
          retrievePhase: 'after-metadata',
          typeNames: ['PlatformComputeApp'],
        }),
      ]);
      set.transportPipeline = pipeline;
      const run = sinon.spy(pipeline, 'runBeforeMetadata');
      expect((await set.getObject()).Package.types).to.deep.include({
        name: 'PlatformComputeApp',
        members: ['RemoteApp'],
      });
      await set.retrieve({ output: '/custom/output', usernameOrConnection: connection });
      expect((run.firstCall.args[0] as TransportContext & { output?: string }).output).to.equal('/custom/output');
      expect(run.firstCall.args[0].components[0].content).to.be.undefined;
    });

    it('passes package association through the retrieve transport context', async () => {
      const type = registryAccess.getTypeByName('PlatformComputeApp');
      const set = new ComponentSet([{ fullName: 'RemoteApp', type }]);
      const pipeline = new TransportPipeline([
        createMockTransport({
          deployPhase: 'before-metadata',
          retrievePhase: 'after-metadata',
          typeNames: ['PlatformComputeApp'],
        }),
      ]);
      set.transportPipeline = pipeline;
      const run = sinon.spy(pipeline, 'runBeforeMetadata');
      const packageOptions = [{ name: 'NamedPackage', outputDir: '/package/output' }];
      const transportPackageNames = { 'PlatformComputeApp#RemoteApp': 'NamedPackage' };

      await set.retrieve({
        output: '/unpackaged',
        packageOptions,
        transportPackageNames,
        usernameOrConnection: connection,
      });

      expect(run.firstCall.args[0].packageOptions).to.equal(packageOptions);
      expect(run.firstCall.args[0].transportPackageNames).to.equal(transportPackageNames);
    });

    it('selects manifest-only members supplied to the constructor', async () => {
      const type = registryAccess.getTypeByName('PlatformComputeApp');
      const set = new ComponentSet([{ fullName: 'ConstructorApp', type }]);
      const pipeline = new TransportPipeline([
        createMockTransport({
          deployPhase: 'before-metadata',
          retrievePhase: 'after-metadata',
          typeNames: ['PlatformComputeApp'],
        }),
      ]);
      set.transportPipeline = pipeline;
      const group = sinon.spy(pipeline, 'groupByTransport');

      await set.retrieve({ output: '/custom/output', usernameOrConnection: connection });

      expect(group.calledOnce).to.be.true;
      expect(group.firstCall.args[0].map((component: SourceComponent) => component.fullName)).to.deep.equal([
        'ConstructorApp',
      ]);
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
