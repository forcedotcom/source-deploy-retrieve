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

const env = createSandbox();

describe('StaticResourceMetadataTransformer', () => {
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
      const transformer = new StaticResourceMetadataTransformer(component);
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

      expect(transformer.toMetadataFormat()).to.deep.equal({
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
      const transformer = new StaticResourceMetadataTransformer(component);
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
        expect(transformer.toMetadataFormat()).to.deep.equal({
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
      const transformer = new StaticResourceMetadataTransformer(component);

      assert.throws(
        () => transformer.toMetadataFormat(),
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

      const transformer = new StaticResourceMetadataTransformer(component);
      const expectedInfos: WriteInfo[] = [
        {
          source: fs.createReadStream(content),
          relativeDestination: join(type.directoryName, `${baseName(content)}.png`),
        },
        {
          source: fs.createReadStream(xml),
          relativeDestination: join(type.directoryName, basename(xml)),
        },
      ];

      expect(transformer.toSourceFormat()).to.deep.equal({
        component,
        writeInfos: expectedInfos,
      });
    });
  });
});
