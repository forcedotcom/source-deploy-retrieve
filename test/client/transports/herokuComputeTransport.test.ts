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
import sinon from 'sinon';
import { Connection, SfError, SfProject } from '@salesforce/core';
import {
  FileResponse,
  HerokuComputeTransport,
  TransportPipeline,
  RegistryAccess,
  SourceComponent,
  TransportContext,
} from '../../../src';
import * as computeSourceBundle from '../../../src/client/transports/computeSourceBundle';

const registryAccess = new RegistryAccess();

function createComputeComponent(fullName: string, appDir: string): SourceComponent {
  const type = registryAccess.getTypeByName('PlatformComputeApp');
  return new SourceComponent({ name: fullName, type, content: appDir, xml: `${appDir}/${fullName}.compute-meta.xml` });
}

function createMockContext(overrides: Partial<TransportContext> = {}): TransportContext {
  const connection = {
    version: '68.0',
    request: sinon.stub(),
  } as unknown as Connection;

  const project = {
    getPath: () => '/mock/project',
  } as unknown as SfProject;

  return {
    components: [],
    connection,
    project,
    orgId: '00Dxx0000000000',
    ...overrides,
  };
}

describe('HerokuComputeTransport', () => {
  const transport = new HerokuComputeTransport();

  describe('metadata', () => {
    it('should have correct name and phase', () => {
      expect(transport.name).to.equal('herokuCompute');
      expect(transport.phase).to.deep.equal({
        deploy: 'before-metadata',
        retrieve: 'after-metadata',
      });
    });

    it('should describe itself correctly', () => {
      const desc = transport.describe();
      expect(desc.label).to.equal('Heroku Compute');
      expect(desc.endpoint).to.equal('/connect/compute/source');
    });
  });

  describe('handles', () => {
    it('should handle PlatformComputeApp by type name', () => {
      const component = createComputeComponent('MyApp', '/mock/app');
      expect(transport.handles(component)).to.be.true;
    });

    it('should handle components with herokuCompute transport strategy', () => {
      const type = {
        ...registryAccess.getTypeByName('ApexClass'),
        strategies: { adapter: 'default' as const, transport: 'herokuCompute' as const },
      };
      const component = new SourceComponent({ name: 'Test', type });
      expect(transport.handles(component)).to.be.true;
    });

    it('should not handle standard types', () => {
      const type = registryAccess.getTypeByName('ApexClass');
      const component = new SourceComponent({ name: 'MyClass', type });
      expect(transport.handles(component)).to.be.false;
    });
  });

  describe('API version validation', () => {
    it('should throw when API version is below minimum', async () => {
      const context = createMockContext({
        connection: { version: '67.0', request: sinon.stub() } as unknown as Connection,
        components: [createComputeComponent('MyApp', '/mock/app')],
      });

      try {
        await transport.deploy(context);
        expect.fail('should have thrown');
      } catch (err) {
        expect((err as Error).message).to.include('API version 68.0');
        expect((err as Error).message).to.include('current: 67.0');
      }
    });

    it('should not throw when API version meets minimum', async () => {
      const stub = sinon.stub(computeSourceBundle, 'packageComputeBundle');
      stub.resolves({ buffer: Buffer.from('fake'), fileCount: 1 });

      const requestStub = sinon.stub();
      requestStub.resolves({ platformComputeId: 'id', buildId: 'b1', sourceBlobSize: 100, uploadedAt: 'now' });

      const context = createMockContext({
        connection: { version: '68.0', request: requestStub } as unknown as Connection,
        components: [createComputeComponent('MyApp', '/mock/app')],
      });

      const result = await transport.deploy(context);
      expect(result.fileResponses).to.have.lengthOf(1);

      stub.restore();
    });
  });

  describe('deploy', () => {
    let packageStub: sinon.SinonStub;

    beforeEach(() => {
      packageStub = sinon.stub(computeSourceBundle, 'packageComputeBundle');
    });

    afterEach(() => {
      packageStub.restore();
    });

    it('should package and upload each component via Connect API', async () => {
      packageStub.resolves({ buffer: Buffer.from('fake-bundle'), fileCount: 3 });

      const requestStub = sinon.stub();
      requestStub.resolves({
        platformComputeId: 'pc1',
        buildId: 'build1',
        sourceBlobSize: 500,
        uploadedAt: '2026-01-01',
      });

      const context = createMockContext({
        connection: { version: '68.0', request: requestStub } as unknown as Connection,
        components: [createComputeComponent('MyApp', '/mock/app')],
      });

      const result = await transport.deploy(context);

      expect(packageStub.calledOnce).to.be.true;
      expect(packageStub.firstCall.args[0]).to.equal('/mock/app');
      expect(requestStub.calledOnce).to.be.true;
      expect(requestStub.firstCall.args[0]).to.have.property('method', 'POST');
      expect(result.fileResponses).to.have.lengthOf(1);
      expect(result.fileResponses[0]).to.include({ fullName: 'MyApp', type: 'PlatformComputeApp' });
    });

    it('should deploy multiple components in sequence', async () => {
      packageStub.resolves({ buffer: Buffer.from('fake'), fileCount: 1 });

      const requestStub = sinon.stub();
      requestStub.resolves({ platformComputeId: 'pc1', buildId: 'b1', sourceBlobSize: 100, uploadedAt: 'now' });

      const context = createMockContext({
        connection: { version: '68.0', request: requestStub } as unknown as Connection,
        components: [createComputeComponent('App1', '/mock/app1'), createComputeComponent('App2', '/mock/app2')],
      });

      const result = await transport.deploy(context);

      expect(packageStub.calledTwice).to.be.true;
      expect(requestStub.calledTwice).to.be.true;
      expect(result.fileResponses).to.have.lengthOf(2);
    });

    it('should process all components and throw aggregate error when one fails', async () => {
      packageStub.resolves({ buffer: Buffer.from('fake'), fileCount: 1 });

      const requestStub = sinon.stub();
      requestStub
        .onFirstCall()
        .resolves({ platformComputeId: 'pc1', buildId: 'b1', sourceBlobSize: 100, uploadedAt: 'now' });
      requestStub.onSecondCall().rejects(new Error('500 server error'));

      const context = createMockContext({
        connection: { version: '68.0', request: requestStub } as unknown as Connection,
        components: [createComputeComponent('App1', '/mock/app1'), createComputeComponent('App2', '/mock/app2')],
      });

      try {
        await transport.deploy(context);
        expect.fail('should have thrown');
      } catch (err) {
        const sfErr = err as SfError;
        expect(sfErr.message).to.include('Heroku Compute upload failed');
        expect(sfErr.message).to.include('500 server error');
        // partial results attached to error.data
        const responses = sfErr.data as FileResponse[];
        expect(responses).to.have.lengthOf(2);
        expect(responses[0]).to.include({ fullName: 'App1', state: 'Changed' });
        expect(responses[1]).to.include({ fullName: 'App2', state: 'Failed' });
      }
    });

    it('should throw with error details when single component fails', async () => {
      packageStub.resolves({ buffer: Buffer.from('fake'), fileCount: 1 });

      const requestStub = sinon.stub();
      requestStub.rejects(new Error('500 server error'));

      const context = createMockContext({
        connection: { version: '68.0', request: requestStub } as unknown as Connection,
        components: [createComputeComponent('MyApp', '/mock/app')],
      });

      try {
        await transport.deploy(context);
        expect.fail('should have thrown');
      } catch (err) {
        expect((err as Error).message).to.include('Heroku Compute upload failed');
        expect((err as Error).message).to.include('MyApp');
      }
    });
  });

  describe('retrieve', () => {
    it('should throw with error details on download failure', async () => {
      const stub = sinon.stub();
      stub.rejects(new Error('404 not found'));

      const context = createMockContext({
        connection: { version: '68.0', request: stub } as unknown as Connection,
        components: [createComputeComponent('MyApp', '/mock/app')],
      });

      try {
        await transport.retrieve(context);
        expect.fail('should have thrown');
      } catch (err) {
        const sfErr = err as SfError;
        expect(sfErr.message).to.include('Heroku Compute download failed');
        expect(sfErr.message).to.include('MyApp');
        const responses = sfErr.data as FileResponse[];
        expect(responses).to.have.lengthOf(1);
        expect(responses[0]).to.include({ fullName: 'MyApp', state: 'Failed' });
      }
    });
  });

  describe('component validation', () => {
    it('should accept components with a content path', () => {
      const component = createComputeComponent('MyApp', '/project/force-app/platformComputeApps/MyApp');
      expect(component.content).to.equal('/project/force-app/platformComputeApps/MyApp');
    });

    it('should collect failure for component with no content path', () => {
      const type = registryAccess.getTypeByName('PlatformComputeApp');
      const component = new SourceComponent({ name: 'NoPath', type });

      const context = createMockContext({
        components: [component],
      });

      return transport.deploy(context).then(
        () => expect.fail('should have thrown'),
        (err: unknown) => {
          const sfErr = err as SfError;
          expect(sfErr.message).to.include('Heroku Compute upload failed');
          expect(sfErr.message).to.include('NoPath');
          const responses = sfErr.data as FileResponse[];
          expect(responses).to.have.lengthOf(1);
          expect(responses[0].state).to.equal('Failed');
          expect((responses[0] as { error: string }).error).to.include('requires a content path');
        }
      );
    });
  });

  describe('withBuiltinTransports integration', () => {
    it('should auto-register HerokuComputeTransport in pipeline', () => {
      const pipeline = TransportPipeline.withBuiltinTransports();
      const component = createComputeComponent('MyApp', '/mock/app');
      expect(pipeline.hasTransports([component])).to.be.true;
    });

    it('should not match standard types via builtin transports', () => {
      const pipeline = TransportPipeline.withBuiltinTransports();
      const type = registryAccess.getTypeByName('ApexClass');
      const component = new SourceComponent({ name: 'MyClass', type });
      expect(pipeline.hasTransports([component])).to.be.false;
    });
  });
});
