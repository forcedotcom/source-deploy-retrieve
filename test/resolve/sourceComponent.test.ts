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
  regina,
  taraji,
  matchingContentFile,
  mockRegistryData,
} from '../mock/registry';
import { expect } from 'chai';
import { REGINA_COMPONENT } from '../mock/registry/type-constants/reginaConstants';
import { COMPONENT } from '../mock/registry/type-constants/matchingContentFileConstants';
import {
  COMPONENT_1,
  CHILD_1_NAME,
  VIRTUAL_DIR,
  COMPONENT_1_XML_PATH,
  CHILD_2_NAME,
} from '../mock/registry/type-constants/nonDecomposedConstants';
import { createSandbox } from 'sinon';

const env = createSandbox();

describe('SourceComponent', () => {
  it('should return correct fullName for components without a parent', () => {
    expect(REGINA_COMPONENT.fullName).to.equal(REGINA_COMPONENT.name);
  });

  describe('parseXml', () => {
    afterEach(() => env.restore());

    it('should parse the components xml file to json', async () => {
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
          type: mockRegistryData.types.tarajihenson,
          xml: taraji.TARAJI_XML_PATHS[0],
          content: taraji.TARAJI_CONTENT_PATH,
        },
        taraji.TARAJI_VIRTUAL_FS
      );
      expect(component.walkContent()).to.deep.equal(taraji.TARAJI_SOURCE_PATHS);
    });

    it('Should not include source paths that are forceignored', () => {
      const testUtil = new RegistryTestUtil();
      const path = taraji.TARAJI_SOURCE_PATHS[0];
      const forceIgnore = testUtil.stubForceIgnore({
        seed: path,
        accept: [taraji.TARAJI_SOURCE_PATHS[1]],
        deny: [taraji.TARAJI_SOURCE_PATHS[0], taraji.TARAJI_SOURCE_PATHS[2]],
      });
      const component = SourceComponent.createVirtualComponent(
        taraji.TARAJI_COMPONENT,
        taraji.TARAJI_VIRTUAL_FS,
        forceIgnore
      );
      expect(component.walkContent()).to.deep.equal([taraji.TARAJI_SOURCE_PATHS[1]]);
      testUtil.restore();
    });
  });

  describe('Child Components', () => {
    const type = mockRegistryData.types.reginaking;
    const expectedChild = SourceComponent.createVirtualComponent(
      {
        name: 'z',
        type: type.children.types.y,
        xml: regina.REGINA_CHILD_XML_PATH_1,
        parent: regina.REGINA_COMPONENT,
      },
      regina.REGINA_VIRTUAL_FS
    );
    const expectedChild2 = SourceComponent.createVirtualComponent(
      {
        name: 'w',
        type: type.children.types.x,
        xml: regina.REGINA_CHILD_XML_PATH_2,
        parent: regina.REGINA_COMPONENT,
      },
      regina.REGINA_VIRTUAL_FS
    );

    it('should return child components for a component', () => {
      expect(regina.REGINA_COMPONENT.getChildren()).to.deep.equal([expectedChild, expectedChild2]);
    });

    it('should not include children that are forceignored', () => {
      const testUtil = new RegistryTestUtil();
      const forceIgnore = testUtil.stubForceIgnore({
        seed: regina.REGINA_XML_PATH,
        deny: [regina.REGINA_CHILD_XML_PATH_2],
      });
      const component = SourceComponent.createVirtualComponent(
        regina.REGINA_COMPONENT,
        regina.REGINA_VIRTUAL_FS,
        forceIgnore
      );
      expect(component.getChildren()).to.deep.equal([expectedChild]);
      testUtil.restore();
    });

    it('should return correct fullName for components with a parent', () => {
      expect(expectedChild.fullName).to.equal(
        `${regina.REGINA_COMPONENT.name}.${expectedChild.name}`
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
  });
});
