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
import { ARCHIVE_MIME_TYPES } from '../../../src/utils/constants';
import { mockRegistry } from '../../mock/registry';
import { MC_SINGLE_FILE_COMPONENT } from '../../mock/registry/mixedContentSingleFileConstants';
import { TARAJI_COMPONENT, TARAJI_VIRTUAL_FS } from '../../mock/registry/tarajiConstants';
import { TestReadable } from '../../mock/convert/readables';

const env = createSandbox();

describe('StaticResourceMetadataTransformer', () => {
  const rootPackagePath = join('main', 'default');
  beforeEach(() =>
    env
      .stub(VirtualTreeContainer.prototype, 'stream')
      .callsFake((fsPath: string) => new TestReadable(fsPath))
  );

  afterEach(() => env.restore());

  describe('toMetadataFormat', () => {
    it('should rename extension to .resource for content file', async () => {
      const component = MC_SINGLE_FILE_COMPONENT;
      const { type, content, xml } = component;
      env.stub(component, 'parseXml').resolves({
        StaticResource: {
          contentType: 'png',
        },
      });
      const transformer = new StaticResourceMetadataTransformer(mockRegistry);
      const expectedInfos: WriteInfo[] = [
        {
          source: component.tree.stream(content),
          relativeDestination: join(type.directoryName, `${baseName(content)}.${type.suffix}`),
        },
        {
          source: component.tree.stream(xml),
          relativeDestination: join(type.directoryName, basename(xml)),
        },
      ];

      expect(await transformer.toMetadataFormat(component)).to.deep.equal({
        component,
        writeInfos: expectedInfos,
      });
    });

    it('should zip directory content for all supported archive mime types', async () => {
      const component = SourceComponent.createVirtualComponent(TARAJI_COMPONENT, TARAJI_VIRTUAL_FS);
      const { type, content, xml } = component;
      const archive = archiver.create('zip', { zlib: { level: 3 } });
      const archiveDirStub = env.stub(archive, 'directory');
      const archiveFinalizeStub = env.stub(archive, 'finalize');
      const parseXmlStub = env.stub(component, 'parseXml');
      env.stub(archiver, 'create').returns(archive);
      const transformer = new StaticResourceMetadataTransformer(mockRegistry);
      const expectedInfos: WriteInfo[] = [
        {
          source: archive,
          relativeDestination: join(type.directoryName, `${baseName(content)}.${type.suffix}`),
        },
        {
          source: component.tree.stream(xml),
          relativeDestination: join(type.directoryName, basename(xml)),
        },
      ];

      for (const contentType of ARCHIVE_MIME_TYPES) {
        parseXmlStub.resolves({ StaticResource: { contentType } });
        expect(await transformer.toMetadataFormat(component)).to.deep.equal({
          component,
          writeInfos: expectedInfos,
        });
        expect(archiveDirStub.calledOnceWith(content, false)).to.be.true;
        expect(archiveFinalizeStub.calledImmediatelyAfter(archiveDirStub)).to.be.true;
        archiveDirStub.resetHistory();
      }
    });

    it('should throw an error if content is directory but contentType is not an archive type', async () => {
      const component = SourceComponent.createVirtualComponent(TARAJI_COMPONENT, TARAJI_VIRTUAL_FS);
      const contentType = 'nonArchiveType';
      env.stub(component, 'parseXml').resolves({ StaticResource: { contentType } });
      const transformer = new StaticResourceMetadataTransformer(mockRegistry);

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
    it('should rename extension from .resource to a mime extension for content file', async () => {
      const component = MC_SINGLE_FILE_COMPONENT;
      const { type, content, xml } = component;
      env.stub(component, 'parseXml').resolves({
        StaticResource: {
          contentType: 'image/png',
        },
      });

      const transformer = new StaticResourceMetadataTransformer(mockRegistry);
      const expectedInfos: WriteInfo[] = [
        {
          source: component.tree.stream(content),
          relativeDestination: join(
            rootPackagePath,
            type.directoryName,
            `${baseName(content)}.png`
          ),
        },
        {
          source: component.tree.stream(xml),
          relativeDestination: join(rootPackagePath, type.directoryName, basename(xml)),
        },
      ];

      expect(await transformer.toSourceFormat(component)).to.deep.equal({
        component,
        writeInfos: expectedInfos,
      });
    });

    it('should rename extension from .resource for a fallback mime extension', async () => {
      const component = MC_SINGLE_FILE_COMPONENT;
      const { type, content, xml } = component;
      env.stub(component, 'parseXml').resolves({
        StaticResource: {
          contentType: 'application/x-javascript',
        },
      });

      const transformer = new StaticResourceMetadataTransformer(mockRegistry);
      const expectedInfos: WriteInfo[] = [
        {
          source: component.tree.stream(content),
          relativeDestination: join(rootPackagePath, type.directoryName, `${baseName(content)}.js`),
        },
        {
          source: component.tree.stream(xml),
          relativeDestination: join(rootPackagePath, type.directoryName, basename(xml)),
        },
      ];

      expect(await transformer.toSourceFormat(component)).to.deep.equal({
        component,
        writeInfos: expectedInfos,
      });
    });

    it('should rename extension from .resource for an unsupported mime extension', async () => {
      const component = MC_SINGLE_FILE_COMPONENT;
      const { type, content, xml } = component;
      env.stub(component, 'parseXml').resolves({
        StaticResource: {
          contentType: 'application/x-myspace',
        },
      });

      const transformer = new StaticResourceMetadataTransformer(mockRegistry);
      const expectedInfos: WriteInfo[] = [
        {
          source: component.tree.stream(content),
          relativeDestination: join(
            rootPackagePath,
            type.directoryName,
            `${baseName(content)}.bin`
          ),
        },
        {
          source: component.tree.stream(xml),
          relativeDestination: join(rootPackagePath, type.directoryName, basename(xml)),
        },
      ];

      expect(await transformer.toSourceFormat(component)).to.deep.equal({
        component,
        writeInfos: expectedInfos,
      });
    });

    it('should ignore components without content', async () => {
      const component = Object.assign({}, MC_SINGLE_FILE_COMPONENT);
      component.content = undefined;

      const transformer = new StaticResourceMetadataTransformer(mockRegistry);
      expect(await transformer.toSourceFormat(component)).to.deep.equal({
        component,
        writeInfos: [],
      });
    });

    it('should extract an archive', async () => {
      const component = MC_SINGLE_FILE_COMPONENT;
      const { type, xml } = component;
      env.stub(component, 'parseXml').resolves({
        StaticResource: {
          contentType: 'application/zip',
        },
      });
      const cd = {
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
      env.stub(Open, 'file').resolves(cd);

      const transformer = new StaticResourceMetadataTransformer(mockRegistry);
      const expectedInfos: WriteInfo[] = [
        {
          source: component.tree.stream(xml),
          relativeDestination: join(rootPackagePath, type.directoryName, basename(xml)),
        },
      ];
      const extraInfo: WriteInfo[] = [
        {
          source: null,
          relativeDestination: join(rootPackagePath, type.directoryName, 'a', 'b', 'c.css'),
        },
      ];

      const result = await transformer.toSourceFormat(component);
      expect(result.component).to.deep.equal(component);
      expect(result.writeInfos).to.deep.equal(expectedInfos);
      expect(result.getExtraInfos).to.be.a('function');
      expect(await result.getExtraInfos()).to.deep.equal(extraInfo);
    });

    it('should work well for null contentType', async () => {
      const component = MC_SINGLE_FILE_COMPONENT;
      const { type, content, xml } = component;
      env.stub(component, 'parseXml').resolves({
        StaticResource: {
          contentType: undefined,
        },
      });

      const transformer = new StaticResourceMetadataTransformer(mockRegistry);
      const expectedInfos: WriteInfo[] = [
        {
          source: component.tree.stream(content),
          relativeDestination: join(
            rootPackagePath,
            type.directoryName,
            `${baseName(content)}.bin`
          ),
        },
        {
          source: component.tree.stream(xml),
          relativeDestination: join(rootPackagePath, type.directoryName, basename(xml)),
        },
      ];

      expect(await transformer.toSourceFormat(component)).to.deep.equal({
        component,
        writeInfos: expectedInfos,
      });
    });
  });
});
