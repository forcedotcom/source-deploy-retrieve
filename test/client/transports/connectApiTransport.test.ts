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
import { Connection, SfProject } from '@salesforce/core';
import {
  ConnectApiTransport,
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

describe('ConnectApiTransport', () => {
  const transport = new ConnectApiTransport();

  describe('metadata', () => {
    it('should have correct name and phase', () => {
      expect(transport.name).to.equal('connectApi');
      expect(transport.phase).to.deep.equal({
        deploy: 'before-metadata',
        retrieve: 'after-metadata',
      });
    });

    it('should describe itself correctly', () => {
      const desc = transport.describe();
      expect(desc.label).to.equal('Heroku Compute (Connect API)');
      expect(desc.endpoint).to.equal('/connect/compute/source');
    });
  });

  describe('handles', () => {
    it('should handle PlatformComputeApp by type name', () => {
      const component = createComputeComponent('MyApp', '/mock/app');
      expect(transport.handles(component)).to.be.true;
    });

    it('should handle components with connectApi transport strategy', () => {
      const type = {
        ...registryAccess.getTypeByName('ApexClass'),
        strategies: { adapter: 'default' as const, transport: 'connectApi' as const },
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
      const context = createMockContext({
        connection: {
          version: '68.0',
          request: sinon
            .stub()
            .resolves({ platformComputeId: 'id', buildId: 'b1', sourceBlobSize: 100, uploadedAt: 'now' }),
        } as unknown as Connection,
        components: [createComputeComponent('MyApp', '/mock/app')],
      });

      try {
        await transport.deploy(context);
      } catch (err) {
        expect((err as Error).message).to.not.include('API version');
      }
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

    it('should wrap upload errors with SfError', async () => {
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
        expect((err as Error).message).to.include('Connect API upload failed');
        expect((err as Error).message).to.include('500 server error');
      }
    });
  });

  describe('retrieve', () => {
    it('should wrap download errors with SfError', async () => {
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
        expect((err as Error).message).to.include('Connect API download failed');
        expect((err as Error).message).to.include('404 not found');
      }
    });
  });

  describe('resolveAppDir', () => {
    it('should prefer content over xml dirname', () => {
      const component = createComputeComponent('MyApp', '/project/force-app/platformComputeApps/MyApp');
      expect(component.content).to.equal('/project/force-app/platformComputeApps/MyApp');
    });

    it('should throw for component with no content or xml', () => {
      const type = registryAccess.getTypeByName('PlatformComputeApp');
      const component = new SourceComponent({ name: 'NoPath', type });

      const context = createMockContext({
        components: [component],
      });

      return transport.deploy(context).then(
        () => expect.fail('should have thrown'),
        (err: unknown) => {
          expect((err as Error).message).to.include('no content or xml path');
        }
      );
    });
  });

  describe('withBuiltinTransports integration', () => {
    it('should auto-register ConnectApiTransport in pipeline', () => {
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
