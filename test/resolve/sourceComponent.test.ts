/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SourceComponent } from '../../src/resolve';
import { RegistryTestUtil } from './registryTestUtil';
import {
  xmlInFolder,
  decomposed,
  mixedContentDirectory,
  matchingContentFile,
  mockRegistryData,
} from '../mock/registry';
import { expect } from 'chai';
import { DECOMPOSED_COMPONENT } from '../mock/registry/type-constants/decomposedConstants';
import { COMPONENT } from '../mock/registry/type-constants/matchingContentFileConstants';
import {
  COMPONENT_1,
  CHILD_1_NAME,
  VIRTUAL_DIR,
  COMPONENT_1_XML_PATH,
  CHILD_2_NAME,
  MATCHING_RULES_COMPONENT,
} from '../mock/registry/type-constants/nonDecomposedConstants';
import { createSandbox } from 'sinon';

const env = createSandbox();

describe('SourceComponent', () => {
  it('should return correct fullName for components without a parent', () => {
    expect(DECOMPOSED_COMPONENT.fullName).to.equal(DECOMPOSED_COMPONENT.name);
  });

  describe('parseXml', () => {
    afterEach(() => env.restore());

    it('should parse the components xml file to js object', async () => {
      const component = COMPONENT;
      env
        .stub(component.tree, 'readFile')
        .resolves(Buffer.from('<MatchingContentFile><test>something</test></MatchingContentFile>'));
      expect(await component.parseXml()).to.deep.equal({
        MatchingContentFile: {
          test: 'something',
        },
      });
    });

    it('should return empty object if component does not have an xml', async () => {
      const component = new SourceComponent({
        name: 'a',
        type: mockRegistryData.types.matchingcontentfile,
      });
      expect(await component.parseXml()).to.deep.equal({});
    });

    it('should preserve leading zeroes in node values', async () => {
      const component = COMPONENT;
      env
        .stub(component.tree, 'readFile')
        .resolves(Buffer.from('<MatchingContentFile><test>001</test></MatchingContentFile>'));

      const result = await component.parseXml();
      const expected = {
        MatchingContentFile: {
          test: '001',
        },
      };

      expect(result).to.deep.equal(expected);
    });

    it('should parse attributes of nodes', async () => {
      const component = COMPONENT;
      env
        .stub(component.tree, 'readFile')
        .resolves(
          Buffer.from('<MatchingContentFile a="test"><test>something</test></MatchingContentFile>')
        );

      const result = await component.parseXml();
      const expected = {
        MatchingContentFile: {
          '@_a': 'test',
          test: 'something',
        },
      };

      expect(result).to.deep.equal(expected);
    });
  });

  describe('walkContent', () => {
    it('should return empty array if no content is set', () => {
      const component = new SourceComponent({
        name: 'a',
        type: mockRegistryData.types.xmlinfolder,
        xml: xmlInFolder.XML_PATHS[0],
      });
      expect(component.walkContent()).to.be.empty;
    });

    it('should return content if content is a file', () => {
      const component = SourceComponent.createVirtualComponent(matchingContentFile.COMPONENT, [
        {
          dirPath: matchingContentFile.TYPE_DIRECTORY,
          children: [matchingContentFile.CONTENT_NAMES[0]],
        },
      ]);
      expect(component.walkContent()).to.deep.equal([matchingContentFile.CONTENT_PATHS[0]]);
    });

    it('should collect all files if content is directory', () => {
      const component = SourceComponent.createVirtualComponent(
        {
          name: 'a',
          type: mockRegistryData.types.mixedcontentdirectory,
          xml: mixedContentDirectory.MIXED_CONTENT_DIRECTORY_XML_PATHS[0],
          content: mixedContentDirectory.MIXED_CONTENT_DIRECTORY_CONTENT_PATH,
        },
        mixedContentDirectory.MIXED_CONTENT_DIRECTORY_VIRTUAL_FS
      );
      expect(component.walkContent()).to.deep.equal(
        mixedContentDirectory.MIXED_CONTENT_DIRECTORY_SOURCE_PATHS
      );
    });

    it('Should not include source paths that are forceignored', () => {
      const testUtil = new RegistryTestUtil();
      const path = mixedContentDirectory.MIXED_CONTENT_DIRECTORY_SOURCE_PATHS[0];
      const forceIgnore = testUtil.stubForceIgnore({
        seed: path,
        accept: [mixedContentDirectory.MIXED_CONTENT_DIRECTORY_SOURCE_PATHS[1]],
        deny: [
          mixedContentDirectory.MIXED_CONTENT_DIRECTORY_SOURCE_PATHS[0],
          mixedContentDirectory.MIXED_CONTENT_DIRECTORY_SOURCE_PATHS[2],
        ],
      });
      const component = SourceComponent.createVirtualComponent(
        mixedContentDirectory.MIXED_CONTENT_DIRECTORY_COMPONENT,
        mixedContentDirectory.MIXED_CONTENT_DIRECTORY_VIRTUAL_FS,
        forceIgnore
      );
      expect(component.walkContent()).to.deep.equal([
        mixedContentDirectory.MIXED_CONTENT_DIRECTORY_SOURCE_PATHS[1],
      ]);
      testUtil.restore();
    });
  });

  describe('Child Components', () => {
    const type = mockRegistryData.types.decomposed;
    const expectedChild = SourceComponent.createVirtualComponent(
      {
        name: 'z',
        type: type.children.types.y,
        xml: decomposed.DECOMPOSED_CHILD_XML_PATH_1,
        parent: decomposed.DECOMPOSED_COMPONENT,
      },
      decomposed.DECOMPOSED_VIRTUAL_FS
    );
    const expectedChild2 = SourceComponent.createVirtualComponent(
      {
        name: 'w',
        type: type.children.types.x,
        xml: decomposed.DECOMPOSED_CHILD_XML_PATH_2,
        parent: decomposed.DECOMPOSED_COMPONENT,
      },
      decomposed.DECOMPOSED_VIRTUAL_FS
    );

    it('should return child components for a component', () => {
      expect(decomposed.DECOMPOSED_COMPONENT.getChildren()).to.deep.equal([
        expectedChild,
        expectedChild2,
      ]);
    });

    it('should not include children that are forceignored', () => {
      const testUtil = new RegistryTestUtil();
      const forceIgnore = testUtil.stubForceIgnore({
        seed: decomposed.DECOMPOSED_XML_PATH,
        deny: [decomposed.DECOMPOSED_CHILD_XML_PATH_2],
      });
      const component = SourceComponent.createVirtualComponent(
        decomposed.DECOMPOSED_COMPONENT,
        decomposed.DECOMPOSED_VIRTUAL_FS,
        forceIgnore
      );
      expect(component.getChildren()).to.deep.equal([expectedChild]);
      testUtil.restore();
    });

    it('should return correct fullName for components with a parent', () => {
      expect(expectedChild.fullName).to.equal(
        `${decomposed.DECOMPOSED_COMPONENT.name}.${expectedChild.name}`
      );
    });

    it('should return empty array if there is no metadata xml', () => {
      const noXml = SourceComponent.createVirtualComponent(
        {
          name: 'noXml',
          type: mockRegistryData.types.mixedcontentinfolder,
        },
        []
      );
      expect(noXml.getChildren()).to.be.empty;
    });
  });

  describe('Nondecomposed Child Components', () => {
    const type = mockRegistryData.types.nondecomposed;
    const expectedChild = SourceComponent.createVirtualComponent(
      {
        name: CHILD_1_NAME,
        type: type.children.types.nondecomposedchild,
        xml: COMPONENT_1_XML_PATH,
        parent: COMPONENT_1,
      },
      VIRTUAL_DIR
    );
    const expectedChild2 = SourceComponent.createVirtualComponent(
      {
        name: CHILD_2_NAME,
        type: type.children.types.nondecomposedchild,
        xml: COMPONENT_1_XML_PATH,
        parent: COMPONENT_1,
      },
      VIRTUAL_DIR
    );

    it('should return child components for a component', () => {
      expect(COMPONENT_1.getChildren()).to.deep.equal([expectedChild, expectedChild2]);
    });

    it('should return correct fullName', () => {
      expect(expectedChild.fullName).to.equal(expectedChild.name);
    });

    // https://github.com/forcedotcom/salesforcedx-vscode/issues/3210
    it('should return empty children for types that do not have uniqueIdElement but xmlPathToChildren returns elements', () => {
      expect(MATCHING_RULES_COMPONENT.getChildren()).to.deep.equal([]);
    });
  });
});
