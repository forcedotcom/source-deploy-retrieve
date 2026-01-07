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
import { join } from 'node:path';
import { assert, config, expect } from 'chai';
import { createSandbox } from 'sinon';
import { Messages, SfError } from '@salesforce/core';
import { decomposed, matchingContentFile, mixedContentDirectory, xmlInFolder } from '../mock';
import { DECOMPOSED_COMPONENT } from '../mock/type-constants/customObjectConstant';
import { COMPONENT } from '../mock/type-constants/apexClassConstant';
import {
  CHILD_1_NAME,
  CHILD_1_XML,
  CHILD_2_NAME,
  CHILD_2_XML,
  COMPONENT_1,
  COMPONENT_1_XML,
  COMPONENT_1_XML_PATH,
  MATCHING_RULES_COMPONENT_XML_PATH,
  MATCHING_RULES_TYPE,
  TREE,
  VIRTUAL_DIR,
} from '../mock/type-constants/customlabelsConstant';
import {
  DestructiveChangesType,
  MetadataType,
  registry,
  RegistryAccess,
  SourceComponent,
  VirtualTreeContainer,
} from '../../src';
import {
  DECOMPOSED_TOP_LEVEL_CHILD_XML_PATHS,
  DECOMPOSED_TOP_LEVEL_COMPONENT,
} from '../mock/type-constants/customObjectTranslationConstant';
import { DecomposedSourceAdapter } from '../../src/resolve/adapters';
import { DE_METAFILE } from '../mock/type-constants/digitalExperienceBundleConstants';
import { XML_NS_KEY, XML_NS_URL } from '../../src/common';
import { RegistryTestUtil } from './registryTestUtil';

config.truncateThreshold = 0;

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

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
    const comp = new SourceComponent({ name: 'test', type: registry.types.apexclass });
    expect(comp.isMarkedForDelete()).to.be.false;
    expect(comp.getDestructiveChangesType()).to.equal(undefined);

    comp.setMarkedForDelete();
    expect(comp.isMarkedForDelete()).to.be.true;
    expect(comp.getDestructiveChangesType()).to.equal(DestructiveChangesType.POST);

    comp.setMarkedForDelete(DestructiveChangesType.PRE);
    expect(comp.isMarkedForDelete()).to.be.true;
    expect(comp.getDestructiveChangesType()).to.equal(DestructiveChangesType.PRE);

    comp.setMarkedForDelete(false);
    expect(comp.isMarkedForDelete()).to.be.false;
    expect(comp.getDestructiveChangesType()).to.equal(undefined);

    comp.setMarkedForDelete(true);
    expect(comp.isMarkedForDelete()).to.be.true;
    expect(comp.getDestructiveChangesType()).to.equal(DestructiveChangesType.POST);
  });

  it('should return correct relative path for a nested component', () => {
    const registry = new RegistryAccess();
    const inFolderType = registry.getTypeBySuffix('report');
    assert(inFolderType);
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

  it('should return correct relative path for DigitalExperienceBundle', () => {
    const registry = new RegistryAccess();
    const debType = registry.getTypeByName('DigitalExperienceBundle');
    const cmp = new SourceComponent({ name: debType.name, type: debType });

    const metaFile = join('my', 'pkg', 'digitalExperiences', 'site', 'foo', 'foo.digitalExperience-meta.xml');
    const expectedPath = join('digitalExperiences', 'site', 'foo', 'foo.digitalExperience-meta.xml');
    expect(cmp.getPackageRelativePath(metaFile, 'metadata')).to.equal(expectedPath);
  });

  it('should return correct relative path for DigitalExperience', () => {
    const registry = new RegistryAccess();
    assert(typeof DE_METAFILE === 'string');

    const deType = registry.getTypeByName('DigitalExperience');
    const cmp = new SourceComponent({ name: deType.name, type: deType });

    const contentFile = join(
      'my',
      'pkg',
      'digitalExperiences',
      'site',
      'foo',
      'sfdc_cms__view',
      'home',
      'content.json'
    );
    const expectedContentPath = join('digitalExperiences', 'site', 'foo', 'sfdc_cms__view', 'home', 'content.json');
    expect(cmp.getPackageRelativePath(contentFile, 'metadata')).to.equal(expectedContentPath);

    const metaFile = join('my', 'pkg', 'digitalExperiences', 'site', 'foo', 'sfdc_cms__view', 'home', DE_METAFILE);
    const expectedMetaPath = join('digitalExperiences', 'site', 'foo', 'sfdc_cms__view', 'home', DE_METAFILE);
    expect(cmp.getPackageRelativePath(metaFile, 'metadata')).to.equal(expectedMetaPath);

    const variantFile = join('my', 'pkg', 'digitalExperiences', 'site', 'foo', 'sfdc_cms__view', 'home', 'fr.json');
    const expectedVariantPath = join('digitalExperiences', 'site', 'foo', 'sfdc_cms__view', 'home', 'fr.json');
    expect(cmp.getPackageRelativePath(variantFile, 'metadata')).to.equal(expectedVariantPath);
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

    it('should handle improperly formatted xml and throw a helpful message (async)', async () => {
      const component = COMPONENT;
      env
        .stub(component.tree, 'readFile')
        .resolves(Buffer.from('</CustomLabels xmlns="http://soap.sforce.com/2006/04/metadata"></CustomLabels>'));
      try {
        await component.parseXml();
      } catch (e) {
        assert(e instanceof Error);
        expect(e.message).to.include(`error parsing ${component.xml} due to:`);
        expect(e.message).to.include("message: Closing tag 'CustomLabels' can't have attributes or invalid starting.");
        expect(e.message).to.include('line: 1');
        expect(e.message).to.include('code: InvalidTag');
      }
    });

    it('should handle improperly formatted xml and throw a helpful message (sync)', () => {
      const component = COMPONENT;
      env
        .stub(component.tree, 'readFile')
        .resolves(Buffer.from('</CustomLabels xmlns="http://soap.sforce.com/2006/04/metadata"></CustomLabels>'));

      try {
        component.parseXmlSync();
      } catch (e) {
        assert(e instanceof Error);

        expect(e.message).to.include(`error parsing ${component.xml} due to:`);
        expect(e.message).to.include("message: Closing tag 'CustomLabels' can't have attributes or invalid starting.");
        expect(e.message).to.include('line: 1');
        expect(e.message).to.include('code: InvalidTag');
      }
    });

    it('should parse the child components xml content to js object', async () => {
      assert(registry.types.customlabels.children?.types.customlabel);
      const component = new SourceComponent({
        name: 'mylabel',
        type: registry.types.customlabels.children.types.customlabel,
        xml: COMPONENT_1_XML_PATH,
        parent: new SourceComponent({
          name: 'nondecomposed',
          type: registry.types.customlabels,
        }),
      });
      env
        .stub(component.tree, 'readFile')
        .resolves(
          Buffer.from(
            '<CustomLabels>' +
              '   <labels>\n' +
              '        <fullName>mylabel</fullName>\n' +
              '        <language>en_US</language>\n' +
              '        <protected>true</protected>\n' +
              '        <shortDescription>my-app Label 1</shortDescription>\n' +
              '        <value>my-app</value>\n' +
              '    </labels>\n' +
              '</CustomLabels>'
          )
        );
      expect(await component.parseXml()).to.deep.equal({
        fullName: 'mylabel',
        language: 'en_US',
        protected: 'true',
        shortDescription: 'my-app Label 1',
        value: 'my-app',
      });
    });

    it('should return empty object if component does not have an xml', async () => {
      const component = new SourceComponent({
        name: 'a',
        type: registry.types.apexclass,
      });
      expect(await component.parseXml()).to.deep.equal({});
    });

    it('should preserve leading zeroes in node values', async () => {
      const component = new SourceComponent(COMPONENT);
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

    it('should parse cdata node values', async () => {
      const component = new SourceComponent(COMPONENT);
      env
        .stub(component.tree, 'readFile')
        .resolves(Buffer.from('<MatchingContentFile><test><![CDATA[<p>Hello</p>]]></test></MatchingContentFile>'));

      const result = await component.parseXml();
      const expected = {
        MatchingContentFile: {
          test: { __cdata: '<p>Hello</p>' },
        },
      };

      expect(result).to.deep.equal(expected);
    });

    it('should parse attributes of nodes', async () => {
      const component = new SourceComponent(COMPONENT);
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
        type: registry.types.document,
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
          type: registry.types.experiencebundle,
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
    const type = registry.types.customobject;
    assert(type.children);
    const expectedChild = SourceComponent.createVirtualComponent(
      {
        name: 'Fields__c',
        type: type.children.types.customfield,
        xml: decomposed.DECOMPOSED_CHILD_XML_PATH_1,
        parent: decomposed.DECOMPOSED_COMPONENT,
      },
      decomposed.DECOMPOSED_VIRTUAL_FS
    );
    const expectedChild2 = SourceComponent.createVirtualComponent(
      {
        name: 'myValidationRule',
        type: type.children.types.validationrule,
        xml: decomposed.DECOMPOSED_CHILD_XML_PATH_2,
        parent: decomposed.DECOMPOSED_COMPONENT,
      },
      decomposed.DECOMPOSED_VIRTUAL_FS
    );

    it('should return child components for a component', () => {
      const children = decomposed.DECOMPOSED_COMPONENT.getChildren();
      expect(children).to.deep.include(expectedChild);
      expect(children).to.deep.include(expectedChild2);
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
          type: registry.types.documentfolder,
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
      // path/to/objects/customObject__c/classes/a.cls
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
      const adapter = new DecomposedSourceAdapter(type, new RegistryAccess(), undefined, tree);
      const fsPath = join(decomposed.DECOMPOSED_PATH, 'classes', XML_NAMES[0]);

      assert.throws(
        () => adapter.getComponent(fsPath, false),
        SfError,
        messages.getMessage('error_unexpected_child_type', [fsPath, type.name])
      );
    });
  });

  describe('Un-addressable decomposed child (cot/cof)', () => {
    it('gets parent when asked to resolve a child by filePath', () => {
      const expectedTopLevel = DECOMPOSED_TOP_LEVEL_COMPONENT;
      const adapter = new DecomposedSourceAdapter(
        expectedTopLevel.type,
        new RegistryAccess(),
        undefined,
        expectedTopLevel.tree
      );

      const result = adapter.getComponent(DECOMPOSED_TOP_LEVEL_CHILD_XML_PATHS[0], true);
      expect(result?.type).to.deep.equal(expectedTopLevel.type);
      expect(result?.xml).to.equal(expectedTopLevel.xml);
    });
  });

  describe('Nondecomposed Child Components', () => {
    const type = registry.types.customlabels;
    assert(type.children);
    const expectedChild = SourceComponent.createVirtualComponent(
      {
        name: CHILD_1_NAME,
        type: type.children.types.customlabel,
        xml: COMPONENT_1_XML_PATH,
        parent: COMPONENT_1,
      },
      VIRTUAL_DIR
    );
    const expectedChild2 = SourceComponent.createVirtualComponent(
      {
        name: CHILD_2_NAME,
        type: type.children.types.customlabel,
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

    it('throw an error when it cant find the parent xml', () => {
      try {
        expectedChild.parseFromParentXml({
          // notice "B" not "b"
          CustomLaBels: {
            [XML_NS_KEY]: XML_NS_URL,
            [type.directoryName]: [CHILD_1_XML, CHILD_2_XML],
          },
        });
        assert.fail('this should throw');
      } catch (e) {
        assert(e instanceof Error);
        expect(e.message).to.equal(
          'Invalid XML tags or unable to find matching parent xml file for CustomLabel "Child_1"'
        );
      }
    });

    // https://github.com/forcedotcom/salesforcedx-vscode/issues/3210
    it('should return empty children for types that do not have uniqueIdElement but xmlPathToChildren returns elements', () => {
      const noUniqueIdElementType: MetadataType = JSON.parse(JSON.stringify(MATCHING_RULES_TYPE));
      assert(noUniqueIdElementType.children);
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
