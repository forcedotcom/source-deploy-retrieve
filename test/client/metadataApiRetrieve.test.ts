/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { createSandbox, match } from 'sinon';
import { ComponentSet } from '../../src';
import { RequestStatus } from '../../src/client/types';
import { MOCK_DEFAULT_OUTPUT, stubMetadataRetrieve } from '../mock/client/transferOperations';
import { mockRegistry } from '../mock/registry';
import { KATHY_COMPONENTS } from '../mock/registry/kathyConstants';
import { KEANU_COMPONENT } from '../mock/registry/keanuConstants';

const env = createSandbox();

describe('MetadataApiRetrieve', async () => {
  afterEach(() => env.restore());

  it('should retrieve zip and extract to directory', async () => {
    const component = KEANU_COMPONENT;
    const components = new ComponentSet([component], mockRegistry);
    const { operation, convertStub } = await stubMetadataRetrieve(env, {
      components,
      fileProperties: {
        fullName: component.fullName,
        type: component.type.name,
        fileName: component.content,
      },
    });

    await operation.start();

    expect(convertStub.calledOnce).to.be.true;
    expect(
      convertStub.calledWith(match.any, 'source', {
        type: 'directory',
        outputDirectory: MOCK_DEFAULT_OUTPUT,
      })
    ).to.be.true;
  });

  it('should retrieve zip and merge with existing components', async () => {
    const component = KEANU_COMPONENT;
    const components = new ComponentSet([component], mockRegistry);
    const { operation, convertStub } = await stubMetadataRetrieve(env, {
      components,
      merge: true,
      fileProperties: {
        fullName: component.fullName,
        type: component.type.name,
        fileName: component.content,
      },
    });

    await operation.start();

    expect(convertStub.calledOnce).to.be.true;
    expect(
      convertStub.calledWith(match.any, 'source', {
        type: 'merge',
        mergeWith: components.getSourceComponents(),
        defaultDirectory: MOCK_DEFAULT_OUTPUT,
      })
    ).to.be.true;
  });

  describe('Cancellation', () => {
    it('should immediately stop polling', async () => {
      const component = KEANU_COMPONENT;
      const components = new ComponentSet([component], mockRegistry);
      const { operation, checkStatusStub } = await stubMetadataRetrieve(env, { components });

      operation.cancel();
      await operation.start();

      expect(checkStatusStub.notCalled).to.be.true;
    });
  });

  describe('Retrieve Result', () => {
    it('should return successfully retrieved components', async () => {
      const component = KEANU_COMPONENT;
      const fileProperties = {
        fullName: component.fullName,
        type: component.type.name,
        fileName: component.content,
      };
      const { operation } = await stubMetadataRetrieve(env, {
        components: new ComponentSet([KEANU_COMPONENT], mockRegistry),
        merge: true,
        fileProperties,
      });

      const result = await operation.start();

      expect(result.status).to.equal(RequestStatus.Succeeded);
      expect(result.successes).to.deep.equal([
        {
          component,
          properties: fileProperties,
        },
      ]);
    });

    it('should report components that failed to be retrieved', async () => {
      const component = KEANU_COMPONENT;
      const message = `Failed to retrieve components of type '${component.type.name}' named '${component.fullName}'`;
      const { operation } = await stubMetadataRetrieve(env, {
        components: new ComponentSet([KEANU_COMPONENT], mockRegistry),
        messages: { problem: message },
      });

      const result = await operation.start();

      expect(result.status).to.equal(RequestStatus.Failed);
      expect(result.failures).to.deep.equal([
        {
          component: {
            fullName: component.fullName,
            type: component.type,
          },
          message,
        },
      ]);
    });

    it('should report both successful and failed components', async () => {
      const components = [KEANU_COMPONENT, KATHY_COMPONENTS[0], KATHY_COMPONENTS[1]];
      const messages = [
        `Failed to retrieve components of type '${components[0].type.name}' named '${components[0].fullName}'`,
        `Failed to retrieve components of type '${components[1].type.name}' named '${components[1].fullName}'`,
      ];
      const fileProperties = {
        fullName: components[2].fullName,
        type: components[2].type.name,
        fileName: components[2].xml,
      };
      const { operation } = await stubMetadataRetrieve(env, {
        components: new ComponentSet(components, mockRegistry),
        messages: messages.map((m) => ({ problem: m })),
        merge: true,
        fileProperties,
      });

      const result = await operation.start();

      expect(result.status).to.equal(RequestStatus.SucceededPartial);
      expect(result.successes).to.deep.equal([
        {
          component: components[2],
          properties: fileProperties,
        },
      ]);
      expect(result.failures).to.deep.equal([
        {
          component: {
            fullName: components[0].fullName,
            type: components[0].type,
          },
          message: messages[0],
        },
        {
          component: {
            fullName: components[1].fullName,
            type: components[1].type,
          },
          message: messages[1],
        },
      ]);
    });

    it('should report generic failure', async () => {
      const message = 'Something went wrong';
      const { operation } = await stubMetadataRetrieve(env, {
        components: new ComponentSet([KEANU_COMPONENT], mockRegistry),
        messages: { problem: message },
      });

      const result = await operation.start();

      expect(result.status).to.equal(RequestStatus.Failed);
      expect(result.failures).to.deep.equal([{ message }]);
    });

    it('should ignore retrieved "Package" metadata type', async () => {
      const component = KEANU_COMPONENT;
      const fileProperties = [
        {
          fullName: component.fullName,
          type: component.type.name,
          fileName: component.content,
        },
        {
          fullName: 'package.xml',
          type: 'Package',
          fileName: 'package.xml',
        },
      ];
      const { operation } = await stubMetadataRetrieve(env, {
        components: new ComponentSet([KEANU_COMPONENT], mockRegistry),
        merge: true,
        fileProperties,
      });

      const result = await operation.start();

      expect(result.status).to.equal(RequestStatus.Succeeded);
      expect(result.successes).to.deep.equal([
        {
          component,
          properties: fileProperties[0],
        },
      ]);
    });
  });
});
