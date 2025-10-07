/*
 * Copyright 2025, Salesforce, Inc.
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
import { basename, join } from 'node:path';
import { createSandbox } from 'sinon';
import { assert, expect } from 'chai';
import { bundle, document, matchingContentFile, nestedTypes, xmlInFolder } from '../../mock';
import { DefaultMetadataTransformer } from '../../../src/convert/transformers/defaultMetadataTransformer';
import { registry, RegistryAccess, SourceComponent, VirtualTreeContainer, WriteInfo } from '../../../src';
import { TestReadable } from '../../mock/convert/readables';
import { DEFAULT_PACKAGE_ROOT_SFDX, META_XML_SUFFIX } from '../../../src/common';
import { FOLDER_COMPONENT, FOLDER_COMPONENT_MD_FORMAT } from '../../mock/type-constants/documentFolderConstant';
import { extName } from '../../../src/utils';

const env = createSandbox();

describe('DefaultMetadataTransformer', () => {
  const transformer = new DefaultMetadataTransformer();

  beforeEach(() =>
    env.stub(VirtualTreeContainer.prototype, 'stream').callsFake((fsPath: string) => new TestReadable(fsPath))
  );

  afterEach(() => env.restore());

  describe('toMetadataFormat', () => {
    it('should create a WriteInfo for each file in the component', async () => {
      const component = bundle.COMPONENT;
      assert(typeof component.xml === 'string');
      const { directoryName } = component.type;
      const relativeBundle = join(directoryName, basename(bundle.CONTENT_PATH));
      const expectedInfos: WriteInfo[] = [];
      for (const source of component.walkContent()) {
        expectedInfos.push({
          source: component.tree.stream(source),
          output: join(relativeBundle, basename(source)),
        });
      }
      expectedInfos.push({
        source: component.tree.stream(component.xml),
        output: join(relativeBundle, bundle.XML_NAME),
      });

      expect(await transformer.toMetadataFormat(component)).to.deep.equal(expectedInfos);
    });

    it('should strip the -meta.xml suffix for components with no content', async () => {
      const component = SourceComponent.createVirtualComponent(xmlInFolder.COMPONENTS[0], []);
      assert(typeof component.xml === 'string');

      const { directoryName } = component.type;
      const fileName = `${component.fullName}.${component.type.suffix}`;
      const expectedInfos: WriteInfo[] = [
        {
          output: join(directoryName, fileName),
          source: component.tree.stream(component.xml),
        },
      ];

      expect(await transformer.toMetadataFormat(component)).to.deep.equal(expectedInfos);
    });

    it('should remove the -meta.xml suffix for components with no content and in folders', async () => {
      const component = SourceComponent.createVirtualComponent(xmlInFolder.COMPONENTS[0], []);
      assert(typeof component.xml === 'string');

      const fullNameParts = component.fullName.split('/');
      const { directoryName } = component.type;
      const expectedInfos: WriteInfo[] = [
        {
          output: join(directoryName, fullNameParts[0], `${fullNameParts[1]}.${component.type.suffix}`),
          source: component.tree.stream(component.xml),
        },
      ];

      expect(await transformer.toMetadataFormat(component)).to.deep.equal(expectedInfos);
    });

    it('should not remove file extension and preserve -meta.xml for DigitalExperienceBundle', async () => {
      const component = SourceComponent.createVirtualComponent({
        name: 'site/foo',
        type: registry.types.digitalexperiencebundle,
        xml: join(
          'path',
          'to',
          registry.types.digitalexperiencebundle.directoryName,
          'site',
          'foo',
          `foo.${registry.types.digitalexperiencebundle.suffix}${META_XML_SUFFIX}`
        ),
      });
      assert(typeof component.xml === 'string');

      const expectedInfos: WriteInfo[] = [
        {
          source: component.tree.stream(component.xml),
          output: join(component.type.directoryName, 'site', 'foo', `foo.${component.type.suffix}${META_XML_SUFFIX}`),
        },
      ];
      expect(await transformer.toMetadataFormat(component)).to.deep.equal(expectedInfos);
    });

    it('should remove file extension and preserve -meta.xml for folder components', async () => {
      const component = FOLDER_COMPONENT;
      assert(typeof component.xml === 'string');

      const expectedInfos: WriteInfo[] = [
        {
          output: join(component.type.directoryName, `${component.fullName}${META_XML_SUFFIX}`),
          source: component.tree.stream(component.xml),
        },
      ];

      expect(await transformer.toMetadataFormat(component)).to.deep.equal(expectedInfos);
    });

    it('should replace document suffix with original suffix', async () => {
      const component = SourceComponent.createVirtualComponent(document.COMPONENT_MD, document.COMPONENT_VIRTUAL_FS);
      assert(typeof component.xml === 'string');
      assert(typeof component.content === 'string');

      const outputPath = join(component.type.directoryName, component.fullName);
      const expectedInfos: WriteInfo[] = [
        {
          output: outputPath + '.' + extName(component.content),
          source: component.tree.stream(component.content),
        },
        {
          output: outputPath + '.' + extName(component.content) + META_XML_SUFFIX,
          source: component.tree.stream(component.xml),
        },
      ];

      expect(await transformer.toMetadataFormat(component)).to.deep.equal(expectedInfos);
    });

    it('should handle nested components (parent)', async () => {
      // ex: territory2Models/someModel/
      const component = nestedTypes.NESTED_PARENT_COMPONENT;
      assert(typeof component.xml === 'string');

      const expectedInfos: WriteInfo[] = [
        {
          output: join(
            component.type.directoryName,
            component.fullName,
            `${component.fullName}.${component.type.suffix}`
          ),
          source: component.tree.stream(component.xml),
        },
      ];

      expect(await transformer.toMetadataFormat(component)).to.deep.equal(expectedInfos);
    });

    it('should handle nested components (children)', async () => {
      // ex: territory2Models/someModel/rules/someRule.Territory2Rule-meta.xml
      const component = nestedTypes.NESTED_CHILD_COMPONENT;
      assert(typeof component.xml === 'string');
      assert(component.parentType);

      const expectedInfos: WriteInfo[] = [
        {
          output: join(
            component.parentType.directoryName,
            nestedTypes.NESTED_PARENT_COMPONENT.fullName,
            component.type.directoryName,
            `${nestedTypes.CHILD_COMPONENT_NAME}.${component.type.suffix}`
          ),
          source: component.tree.stream(component.xml),
        },
      ];

      expect(await transformer.toMetadataFormat(component)).to.deep.equal(expectedInfos);
    });
  });

  describe('toSourceFormat', () => {
    it('should create a WriteInfo for each file in the component', async () => {
      const component = bundle.COMPONENT;
      assert(typeof component.xml === 'string');

      const { directoryName } = component.type;
      const relativeBundle = join(DEFAULT_PACKAGE_ROOT_SFDX, directoryName, basename(bundle.CONTENT_PATH));
      const expectedInfos: WriteInfo[] = [];
      for (const source of component.walkContent()) {
        expectedInfos.push({
          output: join(relativeBundle, basename(source)),
          source: component.tree.stream(source),
        });
      }
      expectedInfos.push({
        output: join(relativeBundle, bundle.XML_NAME),
        source: component.tree.stream(component.xml),
      });

      expect(await transformer.toSourceFormat({ component })).to.deep.equal(expectedInfos);
    });

    it('should add in the -meta.xml suffix for components with no content', async () => {
      const component = SourceComponent.createVirtualComponent(xmlInFolder.COMPONENTS_MD_FORMAT[0], []);
      assert(typeof component.xml === 'string');

      const { directoryName } = component.type;
      const fileName = `${component.fullName}.${component.type.suffix}${META_XML_SUFFIX}`;
      const expectedInfos: WriteInfo[] = [
        {
          output: join('main', 'default', directoryName, fileName),
          source: component.tree.stream(component.xml),
        },
      ];

      expect(await transformer.toSourceFormat({ component })).to.deep.equal(expectedInfos);
    });

    it('should handle components in folders with no content', async () => {
      const component = SourceComponent.createVirtualComponent(xmlInFolder.COMPONENTS_MD_FORMAT[0], []);
      assert(typeof component.xml === 'string');

      const fullNameParts = component.fullName.split('/');
      const { directoryName } = component.type;
      const expectedInfos: WriteInfo[] = [
        {
          output: join(
            DEFAULT_PACKAGE_ROOT_SFDX,
            directoryName,
            fullNameParts[0],
            `${fullNameParts[1]}.${component.type.suffix}${META_XML_SUFFIX}`
          ),
          source: component.tree.stream(component.xml),
        },
      ];

      expect(await transformer.toSourceFormat({ component })).to.deep.equal(expectedInfos);
    });

    it('should not remove file extension and preserve -meta.xml for DigitalExperienceBundle', async () => {
      const component = SourceComponent.createVirtualComponent({
        name: 'site/foo',
        type: registry.types.digitalexperiencebundle,
        xml: join(
          DEFAULT_PACKAGE_ROOT_SFDX,
          registry.types.digitalexperiencebundle.directoryName,
          'site',
          'foo',
          `foo.${registry.types.digitalexperiencebundle.suffix}${META_XML_SUFFIX}`
        ),
      });
      assert(typeof component.xml === 'string');

      const expectedInfos: WriteInfo[] = [
        {
          source: component.tree.stream(component.xml),
          output: join(
            DEFAULT_PACKAGE_ROOT_SFDX,
            component.type.directoryName,
            'site',
            'foo',
            `foo.${component.type.suffix}${META_XML_SUFFIX}`
          ),
        },
      ];
      expect(await transformer.toSourceFormat({ component })).to.deep.equal(expectedInfos);
    });

    it('should handle folder components', async () => {
      const component = FOLDER_COMPONENT_MD_FORMAT;
      assert(typeof component.type.folderContentType === 'string');
      assert(typeof component.xml === 'string');

      const registryAccess = new RegistryAccess();
      const { directoryName } = registryAccess.getTypeByName(component.type.folderContentType);
      const expectedInfos: WriteInfo[] = [
        {
          output: join(
            DEFAULT_PACKAGE_ROOT_SFDX,
            directoryName,
            `${component.fullName}.${component.type.suffix}${META_XML_SUFFIX}`
          ),
          source: component.tree.stream(component.xml),
        },
      ];

      expect(await transformer.toSourceFormat({ component })).to.deep.equal(expectedInfos);
    });

    it('should merge output with merge component when content is a directory', async () => {
      assert(typeof bundle.COMPONENT.name === 'string');
      const root = join('path', 'to', 'another', bundle.COMPONENT.type.directoryName, bundle.COMPONENT.name);
      const component = SourceComponent.createVirtualComponent(
        {
          name: 'a',
          type: registry.types.auradefinitionbundle,
          xml: join(root, 'a.js-meta.xml'),
          content: root,
        },
        [
          {
            dirPath: root,
            children: ['a.js-meta.xml', 'b.c', 'd.e'],
          },
        ]
      );
      const mergeWith = bundle.COMPONENT;
      assert(typeof mergeWith.content === 'string');

      const expectedInfos: WriteInfo[] = [
        {
          output: join(mergeWith.content, 'b.c'),
          source: component.tree.stream(join(root, 'b.c')),
        },
        {
          output: join(mergeWith.content, 'd.e'),
          source: component.tree.stream(join(root, 'd.e')),
        },
        {
          output: join(mergeWith.content, 'myComponent.js-meta.xml'),
          source: component.tree.stream(join(root, 'a.js-meta.xml')),
        },
      ];

      expect(await transformer.toSourceFormat({ component, mergeWith })).to.deep.equal(expectedInfos);
    });

    it('should merge output with merge component when content is a file', async () => {
      const root = join('path', 'to', 'another', registry.types.apexclass.directoryName);
      const component = SourceComponent.createVirtualComponent(
        {
          name: 'a',
          type: registry.types.apexclass,
          xml: join(root, matchingContentFile.XML_NAMES[0]),
          content: join(root, matchingContentFile.CONTENT_NAMES[0]),
        },
        [
          {
            dirPath: root,
            children: [matchingContentFile.XML_NAMES[0], matchingContentFile.CONTENT_NAMES[0]],
          },
        ]
      );
      const mergeWith = matchingContentFile.COMPONENT;
      assert(typeof mergeWith.content === 'string');
      assert(typeof mergeWith.xml === 'string');

      const expectedInfos: WriteInfo[] = [
        {
          output: mergeWith.content,
          source: component.tree.stream(join(root, matchingContentFile.CONTENT_NAMES[0])),
        },
        {
          output: mergeWith.xml,
          source: component.tree.stream(join(root, matchingContentFile.XML_NAMES[0])),
        },
      ];

      expect(await transformer.toSourceFormat({ component, mergeWith })).to.deep.equal(expectedInfos);
    });

    it('should use merge component xml path', async () => {
      const mergeWith = xmlInFolder.COMPONENTS[0];
      assert(typeof mergeWith.xml === 'string');
      const component = SourceComponent.createVirtualComponent(
        {
          name: mergeWith.name,
          type: mergeWith.type,
          xml: join('path', 'to', 'another', mergeWith.type.directoryName, basename(mergeWith.xml)),
        },
        []
      );
      assert(typeof component.xml === 'string');
      expect(await transformer.toSourceFormat({ component, mergeWith })).to.deep.contain({
        output: mergeWith.xml,
        source: component.tree.stream(component.xml),
      });
    });

    it('should use default relative package path if merge component has no xml', async () => {
      const component = matchingContentFile.COMPONENT;
      const mergeWith = SourceComponent.createVirtualComponent(
        {
          name: 'a',
          type: registry.types.apexclass,
        },
        []
      );
      assert(typeof component.xml === 'string');

      expect(await transformer.toSourceFormat({ component, mergeWith })).to.deep.contain({
        output: component.getPackageRelativePath(component.xml, 'source'),
        source: component.tree.stream(component.xml),
      });
    });

    it('should replace original suffix with type suffix', async () => {
      const component = SourceComponent.createVirtualComponent(document.COMPONENT, document.COMPONENT_VIRTUAL_FS);
      assert(typeof component.xml === 'string');
      assert(typeof component.content === 'string');

      const outputPath = join(DEFAULT_PACKAGE_ROOT_SFDX, component.type.directoryName, component.fullName);
      const expectedInfos: WriteInfo[] = [
        {
          output: `${outputPath}.${extName(component.content)}`,
          source: component.tree.stream(component.content),
        },
        {
          output: `${outputPath}.${component.type.suffix}${META_XML_SUFFIX}`,
          source: component.tree.stream(component.xml),
        },
      ];

      expect(await transformer.toSourceFormat({ component })).to.deep.equal(expectedInfos);
    });
  });
});
