/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  bundle,
  xmlInFolder,
  document,
  matchingContentFile,
  mockRegistry,
  mockRegistryData,
} from '../../mock/registry';
import { DefaultMetadataTransformer } from '../../../src/convert/transformers/defaultMetadataTransformer';
import { WriteInfo } from '../../../src/convert';
import { join, basename } from 'path';
import { createSandbox } from 'sinon';
import { TestReadable } from '../../mock/convert/readables';
import { expect } from 'chai';
import { DEFAULT_PACKAGE_ROOT_SFDX, META_XML_SUFFIX } from '../../../src/common';
import { SourceComponent, VirtualTreeContainer } from '../../../src';
import {
  FOLDER_COMPONENT,
  FOLDER_COMPONENT_MD_FORMAT,
} from '../../mock/registry/type-constants/mixedContentInFolderConstants';
import { extName } from '../../../src/utils';

const env = createSandbox();

describe('DefaultMetadataTransformer', () => {
  const transformer = new DefaultMetadataTransformer(mockRegistry);

  beforeEach(() =>
    env
      .stub(VirtualTreeContainer.prototype, 'stream')
      .callsFake((fsPath: string) => new TestReadable(fsPath))
  );

  afterEach(() => env.restore());

  describe('toMetadataFormat', () => {
    it('should create a WriteInfo for each file in the component', async () => {
      const component = bundle.COMPONENT;
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
      const fullNameParts = component.fullName.split('/');
      const { directoryName } = component.type;
      const expectedInfos: WriteInfo[] = [
        {
          output: join(
            directoryName,
            fullNameParts[0],
            `${fullNameParts[1]}.${component.type.suffix}`
          ),
          source: component.tree.stream(component.xml),
        },
      ];

      expect(await transformer.toMetadataFormat(component)).to.deep.equal(expectedInfos);
    });

    it('should remove file extension and preserve -meta.xml for folder components', async () => {
      const component = FOLDER_COMPONENT;
      const expectedInfos: WriteInfo[] = [
        {
          output: join(component.type.directoryName, `${component.fullName}${META_XML_SUFFIX}`),
          source: component.tree.stream(component.xml),
        },
      ];

      expect(await transformer.toMetadataFormat(component)).to.deep.equal(expectedInfos);
    });

    it('should replace document suffix with original suffix', async () => {
      const component = SourceComponent.createVirtualComponent(
        document.COMPONENT_MD,
        document.COMPONENT_VIRTUAL_FS
      );
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
  });

  describe('toSourceFormat', () => {
    it('should create a WriteInfo for each file in the component', async () => {
      const component = bundle.COMPONENT;
      const { directoryName } = component.type;
      const relativeBundle = join(
        DEFAULT_PACKAGE_ROOT_SFDX,
        directoryName,
        basename(bundle.CONTENT_PATH)
      );
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

      expect(await transformer.toSourceFormat(component)).to.deep.equal(expectedInfos);
    });

    it('should add in the -meta.xml suffix for components with no content', async () => {
      const component = SourceComponent.createVirtualComponent(
        xmlInFolder.COMPONENTS_MD_FORMAT[0],
        []
      );
      const { directoryName } = component.type;
      const fileName = `${component.fullName}.${component.type.suffix}${META_XML_SUFFIX}`;
      const expectedInfos: WriteInfo[] = [
        {
          output: join('main', 'default', directoryName, fileName),
          source: component.tree.stream(component.xml),
        },
      ];

      expect(await transformer.toSourceFormat(component)).to.deep.equal(expectedInfos);
    });

    it('should handle components in folders with no content', async () => {
      const component = SourceComponent.createVirtualComponent(
        xmlInFolder.COMPONENTS_MD_FORMAT[0],
        []
      );
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

      expect(await transformer.toSourceFormat(component)).to.deep.equal(expectedInfos);
    });

    it('should handle folder components', async () => {
      const component = FOLDER_COMPONENT_MD_FORMAT;
      const { directoryName } = mockRegistry.getTypeByName(component.type.folderContentType);
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

      expect(await transformer.toSourceFormat(component)).to.deep.equal(expectedInfos);
    });

    it('should merge output with merge component when content is a directory', async () => {
      const root = join(
        'path',
        'to',
        'another',
        bundle.COMPONENT.type.directoryName,
        bundle.COMPONENT.name
      );
      const component = SourceComponent.createVirtualComponent(
        {
          name: 'a',
          type: mockRegistryData.types.bundle,
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
          output: join(mergeWith.content, 'a.js-meta.xml'),
          source: component.tree.stream(join(root, 'a.js-meta.xml')),
        },
      ];

      expect(await transformer.toSourceFormat(component, mergeWith)).to.deep.equal(expectedInfos);
    });

    it('should merge output with merge component when content is a file', async () => {
      const root = join(
        'path',
        'to',
        'another',
        mockRegistryData.types.matchingcontentfile.directoryName
      );
      const component = SourceComponent.createVirtualComponent(
        {
          name: 'a',
          type: mockRegistryData.types.matchingcontentfile,
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

      expect(await transformer.toSourceFormat(component, mergeWith)).to.deep.equal(expectedInfos);
    });

    it('should use merge component xml path', async () => {
      const mergeWith = xmlInFolder.COMPONENTS[0];
      const component = SourceComponent.createVirtualComponent(
        {
          name: mergeWith.name,
          type: mergeWith.type,
          xml: join('path', 'to', 'another', mergeWith.type.directoryName, basename(mergeWith.xml)),
        },
        []
      );

      expect(await transformer.toSourceFormat(component, mergeWith)).to.deep.contain({
        output: mergeWith.xml,
        source: component.tree.stream(component.xml),
      });
    });

    it('should use default relative package path if merge component has no xml', async () => {
      const component = matchingContentFile.COMPONENT;
      const mergeWith = SourceComponent.createVirtualComponent(
        {
          name: 'a',
          type: mockRegistryData.types.matchingcontentfile,
        },
        []
      );

      expect(await transformer.toSourceFormat(component, mergeWith)).to.deep.contain({
        output: component.getPackageRelativePath(component.xml, 'source'),
        source: component.tree.stream(component.xml),
      });
    });

    it('should replace original suffix with type suffix', async () => {
      const component = SourceComponent.createVirtualComponent(
        document.COMPONENT,
        document.COMPONENT_VIRTUAL_FS
      );
      const outputPath = join(
        DEFAULT_PACKAGE_ROOT_SFDX,
        component.type.directoryName,
        component.fullName
      );
      const expectedInfos: WriteInfo[] = [
        {
          output: outputPath + '.' + extName(component.content),
          source: component.tree.stream(component.content),
        },
        {
          output: outputPath + '.' + component.type.suffix + META_XML_SUFFIX,
          source: component.tree.stream(component.xml),
        },
      ];

      expect(await transformer.toSourceFormat(component)).to.deep.equal(expectedInfos);
    });
  });
});
