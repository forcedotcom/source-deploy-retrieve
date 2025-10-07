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
import { Readable } from 'node:stream';
import { basename, join } from 'node:path';
import deepEqualInAnyOrder from 'deep-equal-in-any-order';
import { Messages } from '@salesforce/core';
import chai, { assert, expect } from 'chai';
import { createSandbox } from 'sinon';
import JSZip from 'jszip';
import { registry, SourceComponent, VirtualTreeContainer, WriteInfo } from '../../../src';
import { StaticResourceMetadataTransformer } from '../../../src/convert/transformers/staticResourceMetadataTransformer';
import { baseName } from '../../../src/utils';
import { mixedContentSingleFile } from '../../mock';
import {
  MIXED_CONTENT_DIRECTORY_DIR,
  MIXED_CONTENT_DIRECTORY_CONTENT_DIR,
  MIXED_CONTENT_DIRECTORY_COMPONENT,
  MIXED_CONTENT_DIRECTORY_VIRTUAL_FS,
  MIXED_CONTENT_DIRECTORY_XML_NAMES,
  MIXED_CONTENT_DIRECTORY_XML_PATHS,
} from '../../mock/type-constants/staticresourceConstant';
import { TestReadable } from '../../mock/convert/readables';
import { DEFAULT_PACKAGE_ROOT_SFDX } from '../../../src/common';

chai.use(deepEqualInAnyOrder);

const env = createSandbox();

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

describe('StaticResourceMetadataTransformer', () => {
  const transformer = new StaticResourceMetadataTransformer();
  transformer.defaultDirectory = 'test';
  let pipelineStub: sinon.SinonStub;

  beforeEach(() => {
    env.stub(VirtualTreeContainer.prototype, 'stream').callsFake((fsPath: string) => new TestReadable(fsPath));
    // @ts-ignore private method stub
    pipelineStub = env.stub(transformer, 'pipeline').resolves();
  });

  afterEach(() => env.restore());

  describe('toMetadataFormat', () => {
    it('should rename extension to .resource for content file', async () => {
      const component = mixedContentSingleFile.COMPONENT;
      const { type, content, xml } = component;
      assert(content);
      assert(xml);
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
      const { content, xml } = component;
      assert(content);
      assert(xml);

      // @ts-ignore restore the stub to set a different one that implements Readable._read()
      VirtualTreeContainer.prototype.stream.restore();
      env.stub(VirtualTreeContainer.prototype, 'stream').callsFake((fsPath: string) => {
        const readable = new TestReadable(fsPath);
        readable._read = () => 'do nothing';
        return readable;
      });

      const jszipFileSpy = env.spy(JSZip.prototype, 'file');
      const jszipStreamSpy = env.spy(JSZip.prototype, 'generateNodeStream');
      const parseXmlStub = env.stub(component, 'parseXml');

      for (const contentType of StaticResourceMetadataTransformer.ARCHIVE_MIME_TYPES) {
        parseXmlStub.resolves({ StaticResource: { contentType } });
        // eslint-disable-next-line no-await-in-loop
        const result = await transformer.toMetadataFormat(component);
        expect(jszipFileSpy.calledThrice).to.be.true;
        expect(jszipFileSpy.firstCall.args[0]).to.not.contain('\\', 'zip must only contain posix paths');
        expect(jszipFileSpy.secondCall.args[0]).to.not.contain('\\', 'zip must only contain posix paths');
        expect(jszipFileSpy.thirdCall.args[0]).to.not.contain('\\', 'zip must only contain posix paths');
        expect(jszipStreamSpy.calledOnce).to.be.true;
        expect(jszipStreamSpy.firstCall.args[0]).to.deep.equal({
          compression: 'DEFLATE',
          compressionOptions: { level: 9 },
          streamFiles: true,
          type: 'nodebuffer',
        });
        expect(result).to.be.an('array').with.lengthOf(2);
        for (const res of result) {
          expect(res.output).to.be.a('string');
          expect(res.source).to.be.instanceOf(Readable);
        }
        jszipStreamSpy.resetHistory();
        jszipFileSpy.resetHistory();
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
        assert(false, 'Should have thrown an error');
      } catch (e) {
        assert(e instanceof Error);
        expect(e.name).to.equal('LibraryError');
        expect(e.message).to.equal(
          messages.getMessage('error_static_resource_expected_archive_type', [contentType, component.name])
        );
      }
    });

    it('should throw an error if content is directory but there is no resource-meta.xml file', async () => {
      const component = SourceComponent.createVirtualComponent(
        MIXED_CONTENT_DIRECTORY_COMPONENT,
        MIXED_CONTENT_DIRECTORY_VIRTUAL_FS
      );
      assert(typeof component.name === 'string');

      // when there's no matching component.resource-meta.xml file
      env.stub(component, 'parseXml').resolves({ StaticResource: undefined });

      try {
        await transformer.toMetadataFormat(component);
        assert(false, 'Should have thrown an error');
      } catch (e) {
        assert(e instanceof Error);

        expect(e.message).to.deep.equalInAnyOrder(
          messages.getMessage('error_static_resource_missing_resource_file', [join('staticresources', component.name)])
        );
      }
    });

    it('should throw an error if content is a directory but there are no child content files', async () => {
      // This looks like:
      //   --  path/to/staticresources
      //    |_  aStaticResource  (empty dir)
      //    |_  aStaticResource.resource-meta.xml
      const virtualFsEmptyContentDir = [
        {
          dirPath: MIXED_CONTENT_DIRECTORY_DIR,
          children: [MIXED_CONTENT_DIRECTORY_XML_NAMES[0]],
        },
        {
          dirPath: MIXED_CONTENT_DIRECTORY_CONTENT_DIR,
          children: [],
        },
      ];
      const comp = new SourceComponent({
        name: 'aStaticResource',
        type: registry.types.staticresource,
        xml: MIXED_CONTENT_DIRECTORY_XML_PATHS[0],
        content: MIXED_CONTENT_DIRECTORY_CONTENT_DIR,
      });
      const component = SourceComponent.createVirtualComponent(comp, virtualFsEmptyContentDir);
      assert(typeof component.name === 'string');

      const [contentType] = StaticResourceMetadataTransformer.ARCHIVE_MIME_TYPES;
      env.stub(component, 'parseXml').resolves({ StaticResource: { contentType } });

      try {
        await transformer.toMetadataFormat(component);
        assert(false, 'Should have thrown an error');
      } catch (e) {
        assert(e instanceof Error);
        expect(e.message).to.deep.equalInAnyOrder(
          messages.getMessage('noContentFound', [component.name, component.type.name])
        );
      }
    });
  });

  describe('toSourceFormat', () => {
    it('should rename extension from .resource to a mime extension for content file', async () => {
      const component = mixedContentSingleFile.COMPONENT;
      const { type, content, xml } = component;
      assert(content);
      assert(xml);
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

      expect(await transformer.toSourceFormat({ component })).to.deep.equalInAnyOrder(expectedInfos);
    });

    it('should rename extension from .resource for a fallback mime extension', async () => {
      const component = mixedContentSingleFile.COMPONENT;
      const { type, content, xml } = component;
      assert(content);
      assert(xml);
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

      expect(await transformer.toSourceFormat({ component })).to.deep.equalInAnyOrder(expectedInfos);
    });

    it('should rename extension from .resource for an unsupported mime extension', async () => {
      const component = mixedContentSingleFile.COMPONENT;

      const { type, content, xml } = component;
      assert(content);
      assert(xml);
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

      expect(await transformer.toSourceFormat({ component })).to.deep.equalInAnyOrder(expectedInfos);
    });

    it('should ignore components without content', async () => {
      const component = Object.assign({}, mixedContentSingleFile.COMPONENT);
      component.content = undefined;

      expect(await transformer.toSourceFormat({ component })).to.deep.equal([]);
    });

    it('should extract an archive', async () => {
      assert(typeof transformer.defaultDirectory === 'string');

      const component = mixedContentSingleFile.COMPONENT;
      const { type, xml } = component;
      assert(xml);
      env.stub(component, 'parseXml').resolves({
        StaticResource: {
          contentType: 'application/zip',
        },
      });

      const filePath = join('b', 'c.css');
      const testZip = new JSZip().file(filePath, 'fake css content');
      env.stub(JSZip, 'loadAsync').resolves(testZip);

      const expectedInfos: WriteInfo[] = [
        {
          source: component.tree.stream(xml),
          output: join(DEFAULT_PACKAGE_ROOT_SFDX, type.directoryName, basename(xml)),
        },
      ];

      expect(await transformer.toSourceFormat({ component })).to.deep.equalInAnyOrder(expectedInfos);
      expect(pipelineStub.callCount).to.equal(1);
      expect(pipelineStub.firstCall.args[1]).to.equal(
        join(
          transformer.defaultDirectory,
          DEFAULT_PACKAGE_ROOT_SFDX,
          type.directoryName,
          mixedContentSingleFile.COMPONENT_NAMES[0],
          filePath
        )
      );
    });

    it('should work well for null contentType', async () => {
      const component = mixedContentSingleFile.COMPONENT;
      const { type, content, xml } = component;
      assert(content);
      assert(xml);
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

      expect(await transformer.toSourceFormat({ component })).to.deep.equalInAnyOrder(expectedInfos);
    });

    it('should merge output with merge component when content is archive', async () => {
      const root = join('path', 'to', 'another', 'mixedSingleFiles');
      const component = mixedContentSingleFile.COMPONENT;
      assert(component.xml);
      assert(typeof transformer.defaultDirectory === 'string');

      const mergeWith = SourceComponent.createVirtualComponent(
        {
          name: mixedContentSingleFile.COMPONENT.name,
          type: registry.types.staticresource,
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
      assert(mergeWith.xml);
      assert(mergeWith.content);
      env.stub(component, 'parseXml').resolves({
        StaticResource: {
          contentType: 'application/zip',
        },
      });

      const filePath = join('b', 'c.css');
      const testZip = new JSZip().file(filePath, 'fake css content');
      env.stub(JSZip, 'loadAsync').resolves(testZip);

      const expectedInfos: WriteInfo[] = [
        {
          source: component.tree.stream(component.xml),
          output: mergeWith.xml,
        },
      ];

      expect(await transformer.toSourceFormat({ component, mergeWith })).to.deep.equal(expectedInfos);
      expect(pipelineStub.callCount).to.equal(1);
      expect(pipelineStub.firstCall.args[1]).to.deep.equal(
        join(transformer.defaultDirectory, mergeWith.content, 'b', 'c.css')
      );
    });

    it('should merge output with merge component when content is single file', async () => {
      const root = join('path', 'to', 'another', 'mixedSingleFiles');
      const component = mixedContentSingleFile.COMPONENT;
      assert(component.content);
      assert(component.xml);
      const mergeWith = SourceComponent.createVirtualComponent(
        {
          name: mixedContentSingleFile.COMPONENT.name,
          type: registry.types.staticresource,
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
      assert(mergeWith.xml);

      env.stub(component, 'parseXml').resolves({
        StaticResource: {
          contentType: 'text/plain',
        },
      });
      const expectedInfos: WriteInfo[] = [
        {
          source: component.tree.stream(component.content),
          output: `${mergeWith.content}.txt`,
        },
        {
          source: component.tree.stream(component.xml),
          output: mergeWith.xml,
        },
      ];

      expect(await transformer.toSourceFormat({ component, mergeWith })).to.deep.equalInAnyOrder(expectedInfos);
    });
  });
});
