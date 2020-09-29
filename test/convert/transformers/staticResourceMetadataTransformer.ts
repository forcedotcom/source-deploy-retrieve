/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { StaticResourceMetadataTransformer } from '../../../src/convert/transformers/staticResourceMetadataTransformer';
import { createSandbox } from 'sinon';
import { WriteInfo } from '../../../src/convert';
import { basename, join } from 'path';
import { MC_SINGLE_FILE_COMPONENT } from '../../mock/registry/mixedContentSingleFileConstants';
import { baseName } from '../../../src/utils';
import * as fs from 'fs';
import { assert, expect } from 'chai';
import { TestReadable } from '../../mock/convert/readables';
import { TARAJI_COMPONENT, TARAJI_VIRTUAL_FS } from '../../mock/registry/tarajiConstants';
import { ARCHIVE_MIME_TYPES } from '../../../src/utils/constants';
import * as archiver from 'archiver';
import { SourceComponent } from '../../../src';
import { LibraryError } from '../../../src/errors';
import { nls } from '../../../src/i18n';
import { CentralDirectory, Open, Entry } from 'unzipper';
import { mockRegistry } from '../../mock/registry';

const env = createSandbox();

describe('StaticResourceMetadataTransformer', () => {
  const rootPackagePath = join('main', 'default');
  beforeEach(() =>
    // @ts-ignore mock readable isn't an fs readable specifically
    env.stub(fs, 'createReadStream').callsFake((fsPath: string) => new TestReadable(fsPath))
  );

  afterEach(() => env.restore());

  describe('toMetadataFormat', () => {
    it('should rename extension to .resource for content file', () => {
      const component = MC_SINGLE_FILE_COMPONENT;
      const { type, content, xml } = component;
      env.stub(component, 'parseXml').returns({
        StaticResource: {
          contentType: 'png',
        },
      });
      const transformer = new StaticResourceMetadataTransformer(mockRegistry);
      const expectedInfos: WriteInfo[] = [
        {
          source: fs.createReadStream(content),
          relativeDestination: join(type.directoryName, `${baseName(content)}.${type.suffix}`),
        },
        {
          source: fs.createReadStream(xml),
          relativeDestination: join(type.directoryName, basename(xml)),
        },
      ];

      expect(transformer.toMetadataFormat(component)).to.deep.equal({
        component,
        writeInfos: expectedInfos,
      });
    });

    it('should zip directory content for all supported archive mime types', () => {
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
          source: fs.createReadStream(xml),
          relativeDestination: join(type.directoryName, basename(xml)),
        },
      ];

      for (const contentType of ARCHIVE_MIME_TYPES) {
        parseXmlStub.returns({ StaticResource: { contentType } });
        expect(transformer.toMetadataFormat(component)).to.deep.equal({
          component,
          writeInfos: expectedInfos,
        });
        expect(archiveDirStub.calledOnceWith(content, false)).to.be.true;
        expect(archiveFinalizeStub.calledImmediatelyAfter(archiveDirStub)).to.be.true;
        archiveDirStub.resetHistory();
      }
    });

    it('should throw an error if content is directory but contentType is not an archive type', () => {
      const component = SourceComponent.createVirtualComponent(TARAJI_COMPONENT, TARAJI_VIRTUAL_FS);
      const contentType = 'nonArchiveType';
      env.stub(component, 'parseXml').returns({ StaticResource: { contentType } });
      const transformer = new StaticResourceMetadataTransformer(mockRegistry);

      assert.throws(
        () => transformer.toMetadataFormat(component),
        LibraryError,
        nls.localize('error_static_resource_expected_archive_type', [contentType, component.name])
      );
    });
  });

  describe('toSourceFormat', () => {
    it('should rename extension from .resource to a mime extension for content file', () => {
      const component = MC_SINGLE_FILE_COMPONENT;
      const { type, content, xml } = component;
      env.stub(component, 'parseXml').returns({
        StaticResource: {
          contentType: 'image/png',
        },
      });

      const transformer = new StaticResourceMetadataTransformer(mockRegistry);
      const expectedInfos: WriteInfo[] = [
        {
          source: fs.createReadStream(content),
          relativeDestination: join(
            rootPackagePath,
            type.directoryName,
            `${baseName(content)}.png`
          ),
        },
        {
          source: fs.createReadStream(xml),
          relativeDestination: join(rootPackagePath, type.directoryName, basename(xml)),
        },
      ];

      expect(transformer.toSourceFormat(component)).to.deep.equal({
        component,
        writeInfos: expectedInfos,
      });
    });

    it('should rename extension from .resource for a fallback mime extension', () => {
      const component = MC_SINGLE_FILE_COMPONENT;
      const { type, content, xml } = component;
      env.stub(component, 'parseXml').returns({
        StaticResource: {
          contentType: 'application/x-javascript',
        },
      });

      const transformer = new StaticResourceMetadataTransformer(mockRegistry);
      const expectedInfos: WriteInfo[] = [
        {
          source: fs.createReadStream(content),
          relativeDestination: join(rootPackagePath, type.directoryName, `${baseName(content)}.js`),
        },
        {
          source: fs.createReadStream(xml),
          relativeDestination: join(rootPackagePath, type.directoryName, basename(xml)),
        },
      ];

      expect(transformer.toSourceFormat(component)).to.deep.equal({
        component,
        writeInfos: expectedInfos,
      });
    });

    it('should rename extension from .resource for an unsupported mime extension', () => {
      const component = MC_SINGLE_FILE_COMPONENT;
      const { type, content, xml } = component;
      env.stub(component, 'parseXml').returns({
        StaticResource: {
          contentType: 'application/x-myspace',
        },
      });

      const transformer = new StaticResourceMetadataTransformer(mockRegistry);
      const expectedInfos: WriteInfo[] = [
        {
          source: fs.createReadStream(content),
          relativeDestination: join(
            rootPackagePath,
            type.directoryName,
            `${baseName(content)}.bin`
          ),
        },
        {
          source: fs.createReadStream(xml),
          relativeDestination: join(rootPackagePath, type.directoryName, basename(xml)),
        },
      ];

      expect(transformer.toSourceFormat(component)).to.deep.equal({
        component,
        writeInfos: expectedInfos,
      });
    });

    it('should ignore components without content', () => {
      const component = Object.assign({}, MC_SINGLE_FILE_COMPONENT);
      component.content = undefined;

      const transformer = new StaticResourceMetadataTransformer(mockRegistry);
      expect(transformer.toSourceFormat(component)).to.deep.equal({
        component,
        writeInfos: [],
      });
    });

    it('should extract an archive', async () => {
      const component = MC_SINGLE_FILE_COMPONENT;
      const { type, xml } = component;
      env.stub(component, 'parseXml').returns({
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
          source: fs.createReadStream(xml),
          relativeDestination: join(rootPackagePath, type.directoryName, basename(xml)),
        },
      ];
      const extraInfo: WriteInfo[] = [
        {
          source: null,
          relativeDestination: join(rootPackagePath, type.directoryName, 'a', 'b', 'c.css'),
        },
      ];

      const result = transformer.toSourceFormat(component);
      expect(result.component).to.deep.equal(component);
      expect(result.writeInfos).to.deep.equal(expectedInfos);
      expect(result.getExtraInfos).to.be.a('function');
      expect(await result.getExtraInfos()).to.deep.equal(extraInfo);
    });

    it('should work well for null contentType', () => {
      const component = MC_SINGLE_FILE_COMPONENT;
      const { type, content, xml } = component;
      env.stub(component, 'parseXml').returns({
        StaticResource: {
          contentType: undefined,
        },
      });

      const transformer = new StaticResourceMetadataTransformer(mockRegistry);
      const expectedInfos: WriteInfo[] = [
        {
          source: fs.createReadStream(content),
          relativeDestination: join(
            rootPackagePath,
            type.directoryName,
            `${baseName(content)}.bin`
          ),
        },
        {
          source: fs.createReadStream(xml),
          relativeDestination: join(rootPackagePath, type.directoryName, basename(xml)),
        },
      ];

      expect(transformer.toSourceFormat(component)).to.deep.equal({
        component,
        writeInfos: expectedInfos,
      });
    });
  });
});
