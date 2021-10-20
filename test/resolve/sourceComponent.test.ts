/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'path';
import { assert, expect } from 'chai';
import { createSandbox } from 'sinon';
import {
  xmlInFolder,
  decomposed,
  mixedContentDirectory,
  matchingContentFile,
  mockRegistryData,
  mockRegistry,
} from '../mock/registry';
import { DECOMPOSED_COMPONENT } from '../mock/registry/type-constants/decomposedConstants';
import { COMPONENT } from '../mock/registry/type-constants/matchingContentFileConstants';
import {
  COMPONENT_1,
  CHILD_1_NAME,
  CHILD_1_XML,
  VIRTUAL_DIR,
  COMPONENT_1_XML,
  COMPONENT_1_XML_PATH,
  CHILD_2_NAME,
  MATCHING_RULES_TYPE,
  MATCHING_RULES_COMPONENT_XML_PATH,
  TREE,
} from '../mock/registry/type-constants/nonDecomposedConstants';
import { SourceComponent, VirtualTreeContainer } from '../../src/resolve';
import { DecomposedSourceAdapter } from '../../src/resolve/adapters';
import { TypeInferenceError } from '../../src/errors';
import { nls } from '../../src/i18n';
import { MetadataType, RegistryAccess } from '../../src';
import { RegistryTestUtil } from './registryTestUtil';

const env = createSandbox();

describe('SourceComponent', () => {
  it('should return correct fullName for components without a parent', () => {
    expect(DECOMPOSED_COMPONENT.fullName).to.equal(DECOMPOSED_COMPONENT.name);
  });

  it('should return whether the type is addressable', () => {
    const type: MetadataType = {
      id: 'customfieldtranslation',
      name: 'CustomFieldTranslation',
      directoryName: 'fields',
      suffix: 'fieldTranslation',
    };
    expect(new SourceComponent({ name: type.name, type }).isAddressable).to.equal(true);
    type.isAddressable = false;
    expect(new SourceComponent({ name: type.name, type }).isAddressable).to.equal(false);
    type.isAddressable = true;
    expect(new SourceComponent({ name: type.name, type }).isAddressable).to.equal(true);
    type.isAddressable = undefined;
    expect(new SourceComponent({ name: type.name, type }).isAddressable).to.equal(true);
  });

  it('should return correct markedForDelete status', () => {
    expect(COMPONENT.isMarkedForDelete()).to.be.false;
    try {
      COMPONENT.setMarkedForDelete(true);
      expect(COMPONENT.isMarkedForDelete()).to.be.true;
    } finally {
      COMPONENT.setMarkedForDelete(false);
      expect(COMPONENT.isMarkedForDelete()).to.be.false;
    }
  });

  it('should return correct relative path for a nested component', () => {
    const registry = new RegistryAccess();
    const inFolderType = registry.getTypeBySuffix('report');
    const folderContentType = registry.getTypeByName('ReportFolder');
    expect(inFolderType.inFolder).to.be.true;
    expect(folderContentType.folderContentType).to.equal('report');
    const inFolderComp = new SourceComponent({ name: inFolderType.name, type: inFolderType });
    const folderContentComp = new SourceComponent({
      name: folderContentType.name,
      type: folderContentType,
    });
    const inFolderPath = join('my', 'pkg', 'reports', 'foo', 'bar', 'baz.report-meta.xml');
    const expectedPath1 = join('reports', 'foo', 'bar', 'baz.report-meta.xml');
    const relPath1 = inFolderComp.getPackageRelativePath(inFolderPath, 'metadata');
    expect(relPath1).to.equal(expectedPath1);

    const folderContentPath = join('my', 'pkg', 'reports', 'foo', 'bar.reportFolder-meta.xml');
    const expectedPath2 = join('reports', 'foo', 'bar.reportFolder-meta.xml');
    const relPath2 = folderContentComp.getPackageRelativePath(folderContentPath, 'metadata');
    expect(relPath2).to.equal(expectedPath2);
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

    it('should parse the child components xml content to js object', async () => {
      const component = new SourceComponent({
        name: 'nondecomposedchild',
        type: mockRegistryData.types.nondecomposed.children.types.nondecomposedchild,
        xml: COMPONENT_1_XML_PATH,
        parent: new SourceComponent({
          name: 'nondecomposed',
          type: mockRegistryData.types.nondecomposed,
        }),
      });
      env
        .stub(component.tree, 'readFile')
        .resolves(
          Buffer.from(
            '<nondecomposedparent><nondecomposed><id>nondecomposedchild</id><content>something</content></nondecomposed></nondecomposedparent>'
          )
        );
      expect(await component.parseXml()).to.deep.equal({
        content: 'something',
        id: 'nondecomposedchild',
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
        .resolves(Buffer.from('<MatchingContentFile a="test"><test>something</test></MatchingContentFile>'));

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
      expect(component.walkContent()).to.deep.equal(mixedContentDirectory.MIXED_CONTENT_DIRECTORY_SOURCE_PATHS);
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
      expect(component.walkContent()).to.deep.equal([mixedContentDirectory.MIXED_CONTENT_DIRECTORY_SOURCE_PATHS[1]]);
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
      expect(decomposed.DECOMPOSED_COMPONENT.getChildren()).to.deep.equal([expectedChild, expectedChild2]);
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
      expect(expectedChild.fullName).to.equal(`${decomposed.DECOMPOSED_COMPONENT.name}.${expectedChild.name}`);
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

    it('should throw an Error when unexpected child type found in parent folder - regardless of metadata type category', () => {
      // This is most likely an odd project structure such as metadata found within a CustomObject
      // folder that is not a child type of CustomObject. E.g., Layout, SharingRules, ApexClass.
      // This test adds an ApexClass to the equivalent of here:
      // .../main/default/objects/MyObject/classes/MyApexClass.cls-meta.xml
      // The actual ApexClass file path for the test is:
      // path/to/decomposeds/a/classes/a.mcf-meta.xml
      const { CONTENT_NAMES, XML_NAMES } = matchingContentFile;
      const fsUnexpectedChild = [
        {
          dirPath: decomposed.DECOMPOSED_PATH,
          children: [decomposed.DECOMPOSED_CHILD_XML_NAME_1, decomposed.DECOMPOSED_CHILD_DIR, 'classes'],
        },
        {
          dirPath: decomposed.DECOMPOSED_CHILD_DIR_PATH,
          children: [decomposed.DECOMPOSED_CHILD_XML_NAME_2],
        },
        {
          dirPath: join(decomposed.DECOMPOSED_PATH, 'classes'),
          children: [CONTENT_NAMES[0], XML_NAMES[0]],
        },
      ];
      const tree = new VirtualTreeContainer(fsUnexpectedChild);
      const adapter = new DecomposedSourceAdapter(type, mockRegistry, undefined, tree);
      const fsPath = join(decomposed.DECOMPOSED_PATH, 'classes', XML_NAMES[0]);

      assert.throws(
        () => adapter.getComponent(fsPath, false),
        TypeInferenceError,
        nls.localize('error_unexpected_child_type', [fsPath, type.name])
      );
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

    it('should parse child xml from parent xml', () => {
      const childXml = expectedChild.parseFromParentXml(COMPONENT_1_XML);
      expect(childXml).to.deep.equal(CHILD_1_XML);
      expect(COMPONENT_1.parseFromParentXml(COMPONENT_1_XML)).to.deep.equal(COMPONENT_1_XML);
    });

    // https://github.com/forcedotcom/salesforcedx-vscode/issues/3210
    it('should return empty children for types that do not have uniqueIdElement but xmlPathToChildren returns elements', () => {
      const noUniqueIdElementType: MetadataType = JSON.parse(JSON.stringify(MATCHING_RULES_TYPE));
      // remove the uniqueElementType for this test
      delete noUniqueIdElementType.children.types.matchingrule.uniqueIdElement;
      const noUniqueIdElementComponent = new SourceComponent(
        {
          name: noUniqueIdElementType.name,
          type: noUniqueIdElementType,
          xml: MATCHING_RULES_COMPONENT_XML_PATH,
        },
        TREE
      );
      expect(noUniqueIdElementComponent.getChildren()).to.deep.equal([]);
    });
  });
});
