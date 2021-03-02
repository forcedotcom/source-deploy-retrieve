/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { createSandbox, match } from 'sinon';
import { ComponentSet, SourceComponent } from '../../src';
import { RetrieveResult } from '../../src/client/metadataApiRetrieve';
import {
  ComponentStatus,
  FileProperties,
  FileResponse,
  MetadataApiRetrieveStatus,
} from '../../src/client/types';
import { MOCK_DEFAULT_OUTPUT, stubMetadataRetrieve } from '../mock/client/transferOperations';
import { matchingContentFile, mockRegistry, mockRegistryData, xmlInFolder } from '../mock/registry';
import { COMPONENT } from '../mock/registry/matchingContentFileConstants';
import { REGINA_COMPONENT } from '../mock/registry/reginaConstants';

const env = createSandbox();

describe('MetadataApiRetrieve', async () => {
  afterEach(() => env.restore());

  describe('Lifecycle', () => {
    it('should retrieve zip and extract to directory', async () => {
      const component = matchingContentFile.COMPONENT;
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
      const component = matchingContentFile.COMPONENT;
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

    it('should construct a result object with retrieved components', async () => {
      const component = matchingContentFile.COMPONENT;
      const retrievedComponents = new ComponentSet([matchingContentFile.COMPONENT], mockRegistry);
      const fileProperties = {
        fullName: component.fullName,
        type: component.type.name,
        fileName: component.content,
      } as FileProperties;
      const { operation, response } = await stubMetadataRetrieve(env, {
        components: retrievedComponents,
        merge: true,
        fileProperties,
      });

      const result = await operation.start();
      const expected = new RetrieveResult(response, retrievedComponents);

      expect(result).to.deep.equal(expected);
    });

    it('should construct a result object with no components when no components are retrieved', async () => {
      const retrievedComponents = new ComponentSet();
      const { operation, response } = await stubMetadataRetrieve(env, {
        components: retrievedComponents,
        merge: true,
        messages: [
          {
            problem: 'whoops!',
          },
        ],
      });

      const result = await operation.start();
      const expected = new RetrieveResult(response, retrievedComponents);

      expect(result).to.deep.equal(expected);
    });

    it('should immediately stop polling on cancel', async () => {
      const component = matchingContentFile.COMPONENT;
      const components = new ComponentSet([component], mockRegistry);
      const { operation, checkStatusStub } = await stubMetadataRetrieve(env, { components });

      operation.cancel();
      await operation.start();

      expect(checkStatusStub.notCalled).to.be.true;
    });
  });

  describe('RetrieveResult', () => {
    describe('getFileResponses', () => {
      it('should report all files of a component on success', () => {
        const component = COMPONENT;
        const retrievedSet = new ComponentSet([component]);
        const apiStatus = {};
        const result = new RetrieveResult(apiStatus as MetadataApiRetrieveStatus, retrievedSet);

        const responses = result.getFileResponses();
        const baseResponse: FileResponse = {
          state: ComponentStatus.Changed,
          fullName: component.fullName,
          type: component.type.name,
        };
        const expected: FileResponse[] = [
          Object.assign({}, baseResponse, { filePath: component.content }),
          Object.assign({}, baseResponse, { filePath: component.xml }),
        ];

        expect(responses).to.deep.equal(expected);
      });
    });

    it('should report one failure if component does not exist', () => {
      const component = COMPONENT;
      const retrievedSet = new ComponentSet();
      const apiStatus = {
        messages: [
          {
            problem: `Entity of type '${component.type.name}' named '${component.fullName}' cannot be found`,
          },
        ],
      };
      const result = new RetrieveResult(apiStatus as MetadataApiRetrieveStatus, retrievedSet);

      const responses = result.getFileResponses();
      const expected: FileResponse[] = [
        {
          state: ComponentStatus.Failed,
          error: apiStatus.messages[0].problem,
          fullName: component.fullName,
          type: component.type.name,
          problemType: 'Error',
        },
      ];

      expect(responses).to.deep.equal(expected);
    });

    it('should report files of successful component and one failure for an unsuccessful one', () => {
      const successComponent = xmlInFolder.COMPONENTS[0];
      const failComponent = COMPONENT;
      const retrievedSet = new ComponentSet([successComponent]);
      const apiStatus = {
        messages: [
          {
            problem: `Entity of type '${failComponent.type.name}' named '${failComponent.fullName}' cannot be found`,
          },
        ],
      };
      const result = new RetrieveResult(apiStatus as MetadataApiRetrieveStatus, retrievedSet);

      const responses = result.getFileResponses();
      const expected: FileResponse[] = [
        {
          state: ComponentStatus.Failed,
          error: apiStatus.messages[0].problem,
          fullName: failComponent.fullName,
          type: failComponent.type.name,
          problemType: 'Error',
        },
        {
          state: ComponentStatus.Changed,
          fullName: successComponent.fullName,
          type: successComponent.type.name,
          filePath: successComponent.xml,
        },
      ];

      expect(responses).to.deep.equal(expected);
    });

    it('should report unexpected failure message', () => {
      const retrievedSet = new ComponentSet();
      const apiStatus = {
        messages: [
          {
            problem: '\\_(ツ)_/¯ not sure what happened',
          },
        ],
      };
      const result = new RetrieveResult(apiStatus as MetadataApiRetrieveStatus, retrievedSet);

      const responses = result.getFileResponses();
      const expected: FileResponse[] = [
        {
          state: ComponentStatus.Failed,
          error: apiStatus.messages[0].problem,
          fullName: '',
          type: '',
          problemType: 'Error',
        },
      ];

      expect(responses).to.deep.equal(expected);
    });

    /**
     * This is tested on the assumption that the ComponentWriter result directly
     * includes children in the returned set, so we don't need to eagrly resolve
     * the children of a parent.
     */
    it('should not report content files if component type has children', () => {
      const component = REGINA_COMPONENT;
      const retrievedSet = new ComponentSet([component]);
      const apiStatus = {};
      const result = new RetrieveResult(apiStatus as MetadataApiRetrieveStatus, retrievedSet);

      const responses = result.getFileResponses();
      const expected: FileResponse[] = [
        {
          state: ComponentStatus.Changed,
          fullName: component.fullName,
          type: component.type.name,
          filePath: component.xml,
        },
      ];

      expect(responses).to.deep.equal(expected);
    });

    it('should only report xml file if the component has one', () => {
      const component = new SourceComponent(
        {
          name: 'OnlyContent',
          type: mockRegistryData.types.matchingcontentfile,
          content: COMPONENT.content,
        },
        COMPONENT.tree
      );
      const retrievedSet = new ComponentSet([component]);
      const apiStatus = {};
      const result = new RetrieveResult(apiStatus as MetadataApiRetrieveStatus, retrievedSet);

      const responses = result.getFileResponses();
      const expected: FileResponse[] = [
        {
          state: ComponentStatus.Changed,
          fullName: component.fullName,
          type: component.type.name,
          filePath: component.content,
        },
      ];

      expect(responses).to.deep.equal(expected);
    });
  });
});
