/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { createSandbox } from 'sinon';
import { ComponentSet, registryData, SourceComponent } from '../../src';
import { ComponentStatus, RequestStatus } from '../../src/client/types';
import { expect } from 'chai';
import { COMPONENT } from '../mock/registry/matchingContentFileConstants';
import { basename, join } from 'path';
import { MOCK_ASYNC_RESULT, stubMetadataDeploy } from '../mock/client/transferOperations';

const env = createSandbox();

describe('MetadataApiDeploy', () => {
  afterEach(() => env.restore());

  describe('Cancellation', () => {
    it('should cancel immediately if cancelDeploy call returns done = true', async () => {
      const { operation, checkStatusStub, invokeStub } = await stubMetadataDeploy(env);
      invokeStub.withArgs('cancelDeploy', { id: MOCK_ASYNC_RESULT.id }).returns({ done: true });

      operation.cancel();
      await operation.start();

      expect(checkStatusStub.notCalled).to.be.true;
    });

    it('should async cancel if cancelDeploy call returns done = false', async () => {
      const { operation, checkStatusStub, invokeStub } = await stubMetadataDeploy(env);
      invokeStub.withArgs('cancelDeploy', { id: MOCK_ASYNC_RESULT.id }).returns({ done: false });
      checkStatusStub
        .withArgs(MOCK_ASYNC_RESULT.id, true)
        .resolves({ status: RequestStatus.Canceled });

      operation.cancel();
      await operation.start();

      expect(checkStatusStub.calledOnce).to.be.true;
    });
  });

  describe('Deploy Result', () => {
    it('should set "Changed" component status for changed component', async () => {
      const { operation } = await stubMetadataDeploy(env, {
        components: new ComponentSet([COMPONENT]),
        componentSuccesses: {
          changed: 'true',
          created: 'false',
          deleted: 'false',
          fullName: COMPONENT.fullName,
          componentType: COMPONENT.type.name,
        },
      });

      const result = await operation.start();

      expect(result.components).to.deep.equal([
        {
          component: COMPONENT,
          status: ComponentStatus.Changed,
          diagnostics: [],
        },
      ]);
    });

    it('should set "Created" component status for changed component', async () => {
      const { operation } = await stubMetadataDeploy(env, {
        components: new ComponentSet([COMPONENT]),
        componentSuccesses: {
          changed: 'false',
          created: 'true',
          deleted: 'false',
          fullName: COMPONENT.fullName,
          componentType: COMPONENT.type.name,
        },
      });

      const result = await operation.start();

      expect(result.components).to.deep.equal([
        {
          component: COMPONENT,
          status: ComponentStatus.Created,
          diagnostics: [],
        },
      ]);
    });

    it('should set "Deleted" component status for deleted component', async () => {
      const { operation } = await stubMetadataDeploy(env, {
        components: new ComponentSet([COMPONENT]),
        componentSuccesses: {
          changed: 'false',
          created: 'false',
          deleted: 'true',
          fullName: COMPONENT.fullName,
          componentType: COMPONENT.type.name,
        },
      });

      const result = await operation.start();

      expect(result.components).to.deep.equal([
        {
          component: COMPONENT,
          status: ComponentStatus.Deleted,
          diagnostics: [],
        },
      ]);
    });

    it('should set "Failed" component status for failed component', async () => {
      const { operation } = await stubMetadataDeploy(env, {
        components: new ComponentSet([COMPONENT]),
        componentFailures: {
          success: 'false',
          changed: 'false',
          created: 'false',
          deleted: 'false',
          fullName: COMPONENT.fullName,
          componentType: COMPONENT.type.name,
        },
      });

      const result = await operation.start();

      expect(result.components).to.deep.equal([
        {
          component: COMPONENT,
          status: ComponentStatus.Failed,
          diagnostics: [],
        },
      ]);
    });

    it('should set "Unchanged" component status for an unchanged component', async () => {
      const { operation } = await stubMetadataDeploy(env, {
        components: new ComponentSet([COMPONENT]),
        componentFailures: {
          success: 'true',
          changed: 'false',
          created: 'false',
          deleted: 'false',
          fullName: COMPONENT.fullName,
          componentType: COMPONENT.type.name,
        },
      });

      const result = await operation.start();

      expect(result.components).to.deep.equal([
        {
          component: COMPONENT,
          status: ComponentStatus.Unchanged,
          diagnostics: [],
        },
      ]);
    });

    it('should aggregate diagnostics for a component', async () => {
      const { operation } = await stubMetadataDeploy(env, {
        components: new ComponentSet([COMPONENT]),
        componentFailures: [
          {
            success: 'false',
            changed: 'false',
            created: 'false',
            deleted: 'false',
            fullName: COMPONENT.fullName,
            componentType: COMPONENT.type.name,
            problem: 'Expected ;',
            problemType: 'Error',
            lineNumber: '3',
            columnNumber: '7',
          },
          {
            success: 'false',
            changed: 'false',
            created: 'false',
            deleted: 'false',
            fullName: COMPONENT.fullName,
            componentType: COMPONENT.type.name,
            problem: 'Symbol test does not exist',
            problemType: 'Error',
            lineNumber: '8',
            columnNumber: '23',
          },
        ],
      });

      const result = await operation.start();

      expect(result.components).to.deep.equal([
        {
          component: COMPONENT,
          status: ComponentStatus.Failed,
          diagnostics: [
            {
              lineNumber: 3,
              columnNumber: 7,
              error: 'Expected ;',
              problemType: 'Error',
            },
            {
              lineNumber: 8,
              columnNumber: 23,
              error: 'Symbol test does not exist',
              problemType: 'Error',
            },
          ],
        },
      ]);
    });

    it('should fix lwc deploy message issue', async () => {
      const bundlePath = join('path', 'to', 'lwc', 'test');
      const props = {
        name: 'test',
        type: registryData.types.lightningcomponentbundle,
        xml: join(bundlePath, 'test.js-meta.xml'),
        content: bundlePath,
      };
      const component = SourceComponent.createVirtualComponent(props, [
        {
          dirPath: bundlePath,
          children: [basename(props.xml), 'test.js', 'test.html'],
        },
      ]);
      const { operation } = await stubMetadataDeploy(env, {
        components: new ComponentSet([component]),
        componentSuccesses: [
          {
            changed: 'false',
            created: 'true',
            deleted: 'false',
            // expect api to return fullname without the scheme, but alas
            fullName: `markup://c:${component.fullName}`,
            componentType: component.type.name,
          },
        ],
      });

      const result = await operation.start();

      expect(result.components).to.deep.equal([
        {
          component,
          status: ComponentStatus.Created,
          diagnostics: [],
        },
      ]);
    });
  });
});
