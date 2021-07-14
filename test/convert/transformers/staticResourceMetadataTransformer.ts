/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as archiver from 'archiver';
import { expect } from 'chai';
import { join, basename } from 'path';
import { createSandbox } from 'sinon';
import { Entry, CentralDirectory, Open } from 'unzipper';
import { SourceComponent, VirtualTreeContainer } from '../../../src';
import { WriteInfo } from '../../../src/convert';
import { StaticResourceMetadataTransformer } from '../../../src/convert/transformers/staticResourceMetadataTransformer';
import { LibraryError } from '../../../src/errors';
import { nls } from '../../../src/i18n';
import { baseName } from '../../../src/utils';
import { mixedContentSingleFile, mockRegistry, mockRegistryData } from '../../mock/registry';
import {
  MIXED_CONTENT_DIRECTORY_COMPONENT,
  MIXED_CONTENT_DIRECTORY_VIRTUAL_FS,
} from '../../mock/registry/type-constants/mixedContentDirectoryConstants';
import { TestReadable } from '../../mock/convert/readables';
import { DEFAULT_PACKAGE_ROOT_SFDX } from '../../../src/common';

const env = createSandbox();

describe('StaticResourceMetadataTransformer', () => {
  const transformer = new StaticResourceMetadataTransformer(mockRegistry);

  beforeEach(() =>
    env
      .stub(VirtualTreeContainer.prototype, 'stream')
      .callsFake((fsPath: string) => new TestReadable(fsPath))
  );

  afterEach(() => env.restore());

  describe('toMetadataFormat', () => {
    it('should rename extension to .resource for content file', async () => {
      const component = mixedContentSingleFile.COMPONENT;
      const { type, content, xml } = component;
      env.stub(component, 'parseXml').resolves({
        StaticResource: {
          contentType: 'png',
        },
      });

      const expectedInfos: WriteInfo[] = [
        {
          source: component.tree.stream(content),
          output: join(type.directoryName, `${baseName(content)}.${type.suffix}`),
        },
        {
          source: component.tree.stream(xml),
          output: join(type.directoryName, basename(xml)),
        },
      ];

      expect(await transformer.toMetadataFormat(component)).to.deep.equal(expectedInfos);
    });

    it('should zip directory content for all supported archive mime types', async () => {
      const component = SourceComponent.createVirtualComponent(
        MIXED_CONTENT_DIRECTORY_COMPONENT,
        MIXED_CONTENT_DIRECTORY_VIRTUAL_FS
      );
      const { type, content, xml } = component;
      const archive = archiver.create('zip', { zlib: { level: 3 } });
      const archiveDirStub = env.stub(archive, 'directory');
      const archiveFinalizeStub = env.stub(archive, 'finalize');
      const parseXmlStub = env.stub(component, 'parseXml');
      env.stub(archiver, 'create').returns(archive);

      const expectedInfos: WriteInfo[] = [
        {
          source: archive,
          output: join(type.directoryName, `${baseName(content)}.${type.suffix}`),
        },
        {
          source: component.tree.stream(xml),
          output: join(type.directoryName, basename(xml)),
        },
      ];

      for (const contentType of StaticResourceMetadataTransformer.ARCHIVE_MIME_TYPES) {
        parseXmlStub.resolves({ StaticResource: { contentType } });
        expect(await transformer.toMetadataFormat(component)).to.deep.equal(expectedInfos);
        expect(archiveDirStub.calledOnceWith(content, false)).to.be.true;
        expect(archiveFinalizeStub.calledImmediatelyAfter(archiveDirStub)).to.be.true;
        archiveDirStub.resetHistory();
      }
    });

    it('should throw an error if content is directory but contentType is not an archive type', async () => {
      const component = SourceComponent.createVirtualComponent(
        MIXED_CONTENT_DIRECTORY_COMPONENT,
        MIXED_CONTENT_DIRECTORY_VIRTUAL_FS
      );
      const contentType = 'nonArchiveType';
      env.stub(component, 'parseXml').resolves({ StaticResource: { contentType } });

      try {
        await transformer.toMetadataFormat(component);
      } catch (e) {
        expect(e.name).to.equal(LibraryError.name);
        expect(e.message).to.equal(
          nls.localize('error_static_resource_expected_archive_type', [contentType, component.name])
        );
      }
    });
  });

  describe('toSourceFormat', () => {
    const mockCentralDirectory = {
      files: [
        {
          path: 'a',
          type: 'Directory',
          stream: (): Entry => {
            return null;
          },
        },
        {
          path: 'b/c.css',
          type: 'File',
          stream: (): Entry => {
            return null;
          },
        },
      ],
    } as CentralDirectory;

    it('should rename extension from .resource to a mime extension for content file', async () => {
      const component = mixedContentSingleFile.COMPONENT;
      const { type, content, xml } = component;
      env.stub(component, 'parseXml').resolves({
        StaticResource: {
          contentType: 'image/png',
        },
      });

      const expectedInfos: WriteInfo[] = [
        {
          source: component.tree.stream(content),
          output: join(DEFAULT_PACKAGE_ROOT_SFDX, type.directoryName, `${baseName(content)}.png`),
        },
        {
          source: component.tree.stream(xml),
          output: join(DEFAULT_PACKAGE_ROOT_SFDX, type.directoryName, basename(xml)),
        },
      ];

      expect(await transformer.toSourceFormat(component)).to.deep.equal(expectedInfos);
    });

    it('should rename extension from .resource for a fallback mime extension', async () => {
      const component = mixedContentSingleFile.COMPONENT;
      const { type, content, xml } = component;
      env.stub(component, 'parseXml').resolves({
        StaticResource: {
          contentType: 'application/x-javascript',
        },
      });

      const expectedInfos: WriteInfo[] = [
        {
          source: component.tree.stream(content),
          output: join(DEFAULT_PACKAGE_ROOT_SFDX, type.directoryName, `${baseName(content)}.js`),
        },
        {
          source: component.tree.stream(xml),
          output: join(DEFAULT_PACKAGE_ROOT_SFDX, type.directoryName, basename(xml)),
        },
      ];

      expect(await transformer.toSourceFormat(component)).to.deep.equal(expectedInfos);
    });

    it('should rename extension from .resource for an unsupported mime extension', async () => {
      const component = mixedContentSingleFile.COMPONENT;
      const { type, content, xml } = component;
      env.stub(component, 'parseXml').resolves({
        StaticResource: {
          contentType: 'application/x-myspace',
        },
      });

      const expectedInfos: WriteInfo[] = [
        {
          source: component.tree.stream(content),
          output: join(DEFAULT_PACKAGE_ROOT_SFDX, type.directoryName, `${baseName(content)}.bin`),
        },
        {
          source: component.tree.stream(xml),
          output: join(DEFAULT_PACKAGE_ROOT_SFDX, type.directoryName, basename(xml)),
        },
      ];

      expect(await transformer.toSourceFormat(component)).to.deep.equal(expectedInfos);
    });

    it('should ignore components without content', async () => {
      const component = Object.assign({}, mixedContentSingleFile.COMPONENT);
      component.content = undefined;

      expect(await transformer.toSourceFormat(component)).to.deep.equal([]);
    });

    it('should extract an archive', async () => {
      const component = mixedContentSingleFile.COMPONENT;
      const { type, xml } = component;
      env.stub(component, 'parseXml').resolves({
        StaticResource: {
          contentType: 'application/zip',
        },
      });
      env.stub(Open, 'buffer').resolves(mockCentralDirectory);
      const expectedInfos: WriteInfo[] = [
        {
          source: null,
          output: join(DEFAULT_PACKAGE_ROOT_SFDX, type.directoryName, 'a', 'b', 'c.css'),
        },
        {
          source: component.tree.stream(xml),
          output: join(DEFAULT_PACKAGE_ROOT_SFDX, type.directoryName, basename(xml)),
        },
      ];

      expect(await transformer.toSourceFormat(component)).to.deep.equal(expectedInfos);
    });

    it('should work well for null contentType', async () => {
      const component = mixedContentSingleFile.COMPONENT;
      const { type, content, xml } = component;
      env.stub(component, 'parseXml').resolves({
        StaticResource: {
          contentType: undefined,
        },
      });
      const expectedInfos: WriteInfo[] = [
        {
          source: component.tree.stream(content),
          output: join(DEFAULT_PACKAGE_ROOT_SFDX, type.directoryName, `${baseName(content)}.bin`),
        },
        {
          source: component.tree.stream(xml),
          output: join(DEFAULT_PACKAGE_ROOT_SFDX, type.directoryName, basename(xml)),
        },
      ];

      expect(await transformer.toSourceFormat(component)).to.deep.equal(expectedInfos);
    });

    it('should merge output with merge component when content is archive', async () => {
      const root = join('path', 'to', 'another', 'mixedSingleFiles');
      const component = mixedContentSingleFile.COMPONENT;
      const mergeComponent = SourceComponent.createVirtualComponent(
        {
          name: mixedContentSingleFile.COMPONENT.name,
          type: mockRegistryData.types.mixedcontentsinglefile,
          xml: join(root, mixedContentSingleFile.XML_NAMES[0]),
          content: join(root, 'a'),
        },
        [
          {
            dirPath: root,
            children: ['a'],
          },
          {
            dirPath: join(root, 'a'),
            children: [],
          },
        ]
      );
      env.stub(component, 'parseXml').resolves({
        StaticResource: {
          contentType: 'application/zip',
        },
      });
      env.stub(Open, 'buffer').resolves(mockCentralDirectory);
      const expectedInfos: WriteInfo[] = [
        {
          source: null,
          output: join(mergeComponent.content, 'b', 'c.css'),
        },
        {
          source: component.tree.stream(component.xml),
          output: mergeComponent.xml,
        },
      ];

      expect(await transformer.toSourceFormat(component, mergeComponent)).to.deep.equal(
        expectedInfos
      );
    });

    it('should merge output with merge component when content is single file', async () => {
      const root = join('path', 'to', 'another', 'mixedSingleFiles');
      const component = mixedContentSingleFile.COMPONENT;
      const mergeComponent = SourceComponent.createVirtualComponent(
        {
          name: mixedContentSingleFile.COMPONENT.name,
          type: mockRegistryData.types.mixedcontentsinglefile,
          xml: join(root, mixedContentSingleFile.XML_NAMES[0]),
          content: join(root, 'a'),
        },
        [
          {
            dirPath: root,
            children: ['a'],
          },
          {
            dirPath: join(root, 'a'),
            children: [],
          },
        ]
      );
      env.stub(component, 'parseXml').resolves({
        StaticResource: {
          contentType: 'text/plain',
        },
      });
      const expectedInfos: WriteInfo[] = [
        {
          source: component.tree.stream(component.content),
          output: `${mergeComponent.content}.txt`,
        },
        {
          source: component.tree.stream(component.xml),
          output: mergeComponent.xml,
        },
      ];

      expect(await transformer.toSourceFormat(component, mergeComponent)).to.deep.equal(
        expectedInfos
      );
    });
  });
});
