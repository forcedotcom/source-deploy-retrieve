/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { basename, join, sep } from 'path';
import { Readable, Writable } from 'stream';
import * as fs from 'graceful-fs';
import { Logger, SfError, Messages } from '@salesforce/core';
import { expect, assert } from 'chai';
import { createSandbox, SinonStub } from 'sinon';
import JSZip = require('jszip');
import * as streams from '../../src/convert/streams';
import * as fsUtil from '../../src/utils/fileSystemHandler';
import { ComponentSet, MetadataResolver, RegistryAccess, SourceComponent, WriteInfo, WriterFormat } from '../../src';
import { MetadataTransformerFactory } from '../../src/convert/transformers';
import { COMPONENTS } from '../mock/type-constants/reportConstant';
import { XML_DECL, XML_NS_KEY, XML_NS_URL } from '../../src/common';
import { COMPONENT, CONTENT_NAMES, TYPE_DIRECTORY, XML_NAMES } from '../mock/type-constants/apexClassConstant';
import { BaseMetadataTransformer } from '../../src/convert/transformers/baseMetadataTransformer';

const env = createSandbox();
const registryAccess = new RegistryAccess();

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

class TestTransformer extends BaseMetadataTransformer {
  // partial implementation only for tests
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, class-methods-use-this, @typescript-eslint/require-await
  public async toMetadataFormat(component: SourceComponent): Promise<WriteInfo[]> {
    return [{ output: '/type/file.m', source: new Readable() }];
  }
  // partial implementation only for tests
  // eslint-disable-next-line class-methods-use-this, @typescript-eslint/require-await
  public async toSourceFormat(component: SourceComponent, mergeWith?: SourceComponent): Promise<WriteInfo[]> {
    const output = mergeWith ? mergeWith.content ?? mergeWith.xml : '/type/file.s';
    assert(output);
    return [{ output, source: new Readable() }];
  }
}

describe('Streams', () => {
  afterEach(() => env.restore());

  /**
   * NOTE: tests that call _transform methods must utilize Mocha.done to signal
   * when a test has finished and to pass on any assertion failures to the test
   * runner. Otherwise a test may fail but signal that it was successful.
   */
  describe('ComponentConverter', () => {
    const component = COMPONENTS[0];
    const transformer = new TestTransformer();

    beforeEach(() => {
      env.stub(MetadataTransformerFactory.prototype, 'getTransformer').returns(transformer);
    });

    it('should throw error for unexpected conversion format', (done) => {
      // @ts-ignore constructor argument invalid
      const converter = new streams.ComponentConverter('badformat');
      const expectedError = new SfError(
        messages.getMessage('error_convert_invalid_format', ['badformat']),
        'LibraryError'
      );
      // convert overrides node's Transform _transform method
      // eslint-disable-next-line no-underscore-dangle
      converter._transform(component, '', (err: Error | undefined) => {
        try {
          assert(err instanceof Error);
          expect(err.message).to.equal(expectedError.message);
          expect(err.name).to.equal(expectedError.name);
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it('should transform to metadata format', (done) => {
      const converter = new streams.ComponentConverter('metadata', registryAccess);

      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      converter._transform(component, '', async (err: Error | undefined, data: WriterFormat) => {
        try {
          expect(err).to.be.undefined;
          expect(data).to.deep.equal({
            component,
            writeInfos: await transformer.toMetadataFormat(component),
          });
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it('should transform to source format', (done) => {
      const converter = new streams.ComponentConverter('source', registryAccess);

      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      converter._transform(component, '', async (err: Error | undefined, data: WriterFormat) => {
        try {
          expect(err).to.be.undefined;
          expect(data).to.deep.equal({
            component,
            writeInfos: await transformer.toSourceFormat(component),
          });
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it('should transform to source format using a merge component', (done) => {
      const newComponent = SourceComponent.createVirtualComponent(
        {
          name: component.name,
          type: component.type,
          xml: join('path', 'to', 'another', 'kathys', 'a.kathy-meta.xml'),
        },
        []
      );
      const mergeSet = new ComponentSet([component]);
      const converter = new streams.ComponentConverter('source', registryAccess, mergeSet);

      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      converter._transform(newComponent, '', async (err: Error | undefined, data: WriterFormat) => {
        try {
          expect(err).to.be.undefined;
          expect(data).to.deep.equal({
            component: newComponent,
            writeInfos: await transformer.toSourceFormat(newComponent, component),
          });
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it('should transform to source formating using multiple merge components', (done) => {
      const newComponent = new SourceComponent({
        name: component.name,
        type: component.type,
        xml: join('path', 'to', 'another', 'kathys', 'a.kathy-meta.xml'),
      });
      const secondMergeComponent = new SourceComponent({
        name: component.name,
        type: component.type,
        xml: join('path', 'to', 'yetanother', 'kathys', 'a.kathy-meta.xml'),
      });
      const mergeSet = new ComponentSet([component, secondMergeComponent]);
      const converter = new streams.ComponentConverter('source', registryAccess, mergeSet);

      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      converter._transform(newComponent, '', async (err: Error | undefined, data: WriterFormat) => {
        try {
          expect(err).to.be.undefined;
          expect(data).to.deep.equal({
            component: newComponent,
            writeInfos: (await transformer.toSourceFormat(newComponent, component)).concat(
              await transformer.toSourceFormat(newComponent, secondMergeComponent)
            ),
          });
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it('should not transform source that is marked for delete', (done) => {
      const myComp = new SourceComponent({
        name: component.name,
        type: component.type,
        xml: component.xml,
      });
      myComp.setMarkedForDelete();
      const converter = new streams.ComponentConverter('source', registryAccess);

      // eslint-disable-next-line @typescript-eslint/no-misused-promises, @typescript-eslint/require-await
      converter._transform(myComp, '', async (err: Error | undefined, data: WriterFormat) => {
        try {
          expect(err).to.be.undefined;
          expect(data).to.deep.equal({
            component: myComp,
            writeInfos: [],
          });
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    describe('Transaction Finalizers', () => {
      let converter: streams.ComponentConverter;

      beforeEach(() => {
        converter = new streams.ComponentConverter('metadata', registryAccess);
      });

      it('should flush one result from a single transaction finalizer', async () => {
        const format: WriterFormat = { component, writeInfos: [] };
        const pushStub = env.stub(converter, 'push');
        env.stub(converter.context.recomposition, 'finalize').resolves([format]);

        await converter._flush((err) => expect(err).to.be.undefined);

        expect(pushStub.calledOnce).to.be.true;
        expect(pushStub.calledOnceWith(format)).to.be.true;
      });

      it('should flush multiple results from a context finalizer', async () => {
        const pushStub = env.stub(converter, 'push');
        const format: WriterFormat = { component, writeInfos: [] };
        const results = [format, format];
        env.stub(converter.context.recomposition, 'finalize').resolves(results);

        await converter._flush((err) => expect(err).to.be.undefined);

        expect(pushStub.calledTwice).to.be.true;
        expect(pushStub.getCall(0).calledWith(results[0])).to.be.true;
        expect(pushStub.getCall(1).calledWith(results[1])).to.be.true;
      });

      it('should pass error to callback if a problem occurred', async () => {
        const expectedError = new Error('whoops');
        env.stub(converter.context, 'executeFinalizers').throws(expectedError);

        await converter._flush((err: Error | undefined) => expect(err).to.deep.equal(expectedError));
      });
    });
  });

  describe('ComponentWriters', () => {
    const rootDestination = join('path', 'to', 'test-package');
    const absoluteRootDestination = join(sep, 'absolute', 'path');
    const fsWritableMock = new Writable();
    const readableMock = new Readable();
    readableMock._read = (): void => {
      readableMock.push('hi');
      readableMock.push(null);
    };
    assert(COMPONENT.xml);
    assert(COMPONENT.content);

    const component = SourceComponent.createVirtualComponent(COMPONENT, [
      {
        dirPath: TYPE_DIRECTORY,
        children: XML_NAMES.concat(CONTENT_NAMES),
      },
      {
        dirPath: join(rootDestination, COMPONENT.type.directoryName),
        children: [basename(COMPONENT.xml), basename(COMPONENT.content)],
      },
      {
        dirPath: join(absoluteRootDestination, COMPONENT.type.directoryName),
        children: [basename(COMPONENT.xml), basename(COMPONENT.content)],
      },
    ]);
    assert(component.xml);
    assert(component.content);
    const chunk: WriterFormat = {
      component,
      writeInfos: [
        {
          output: component.getPackageRelativePath(component.xml, 'metadata'),
          source: readableMock,
        },
        {
          output: component.getPackageRelativePath(component.content, 'metadata'),
          source: readableMock,
        },
        {
          output: join(absoluteRootDestination, component.getPackageRelativePath(component.xml, 'metadata')),
          source: readableMock,
        },
      ],
    };

    let pipelineStub: SinonStub;

    describe('StandardWriter', () => {
      const resolver = new MetadataResolver(registryAccess, component.tree);
      const resolverSpy = env.spy(resolver, 'getComponentsFromPath');

      let writer: streams.StandardWriter;

      let ensureFile: SinonStub;

      beforeEach(() => {
        writer = new streams.StandardWriter(rootDestination, resolver);
        ensureFile = env.stub(fsUtil, 'ensureFileExists');
        pipelineStub = env.stub(streams, 'pipeline');
        env
          .stub(fs, 'createWriteStream')
          // @ts-ignore
          .returns(fsWritableMock);
      });

      it('should pass errors to _write callback', async () => {
        const whoops = new Error('whoops!');
        pipelineStub.rejects(whoops);

        await writer._write(chunk, '', (err: Error | undefined) => {
          assert(err instanceof Error);
          expect(err.message).to.equal(whoops.message);
          expect(err.name).to.equal(whoops.name);
        });
      });

      it('should join root destination and relative WriteInfo outputs during copy', async () => {
        pipelineStub.resolves();
        const root = join(rootDestination, COMPONENT.type.directoryName);

        await writer._write(chunk, '', (err: Error | undefined) => {
          expect(err).to.be.undefined;
          assert(COMPONENT.xml);
          assert(COMPONENT.content);
          expect(ensureFile.firstCall.args[0]).to.equal(join(root, basename(COMPONENT.xml)));
          expect(ensureFile.secondCall.args[0]).to.equal(join(root, basename(COMPONENT.content)));
          expect(pipelineStub.firstCall.args).to.deep.equal([chunk.writeInfos[0].source, fsWritableMock]);
        });
      });

      it('should use full paths of WriteInfo output if they are absolute during copy', async () => {
        pipelineStub.resolves();
        assert(component.xml);
        assert(component.content);
        const formatWithAbsoluteOutput: WriterFormat = {
          component,
          writeInfos: [
            {
              source: readableMock,
              output: join(absoluteRootDestination, component.getPackageRelativePath(component.xml, 'metadata')),
            },
            {
              source: readableMock,
              output: join(absoluteRootDestination, component.getPackageRelativePath(component.content, 'metadata')),
            },
          ],
        };

        await writer._write(formatWithAbsoluteOutput, '', (err: Error | undefined) => {
          expect(err).to.be.undefined;
          expect(ensureFile.firstCall.args).to.deep.equal([formatWithAbsoluteOutput.writeInfos[0].output]);
          expect(ensureFile.secondCall.args).to.deep.equal([formatWithAbsoluteOutput.writeInfos[1].output]);
          expect(pipelineStub.firstCall.args).to.deep.equal([
            formatWithAbsoluteOutput.writeInfos[0].source,
            fsWritableMock,
          ]);
        });
      });

      it('should resolve copied source components during write', async () => {
        pipelineStub.resolves();

        await writer._write(chunk, '', (err: Error | undefined) => {
          expect(err).to.be.undefined;
          const destination = join(rootDestination, component.type.directoryName);
          const expected = resolver.getComponentsFromPath(destination);
          expect(writer.converted).to.deep.equal(expected);
        });
      });

      it('should skip copying when there are no WriteInfos', async () => {
        pipelineStub.resolves();

        const emptyChunk: WriterFormat = {
          component,
          writeInfos: [],
        };

        await writer._write(emptyChunk, '', (err: Error | undefined) => {
          expect(err).to.be.undefined;
          expect(ensureFile.notCalled).to.be.true;
          expect(pipelineStub.notCalled).to.be.true;
          expect(resolverSpy.notCalled).to.be.true;
        });
      });

      it('should skip duplicate components in WriteInfos', async () => {
        pipelineStub.resolves();
        const loggerStub = env.stub(Logger.prototype, 'debug');
        assert(COMPONENT.xml);
        assert(COMPONENT.content);
        const dupedComponent = SourceComponent.createVirtualComponent(COMPONENT, [
          {
            dirPath: TYPE_DIRECTORY,
            children: XML_NAMES.concat(CONTENT_NAMES),
          },
          {
            dirPath: join(rootDestination, COMPONENT.type.directoryName),
            children: [basename(COMPONENT.xml), basename(COMPONENT.content)],
          },
          {
            dirPath: join(absoluteRootDestination, COMPONENT.type.directoryName),
            children: [basename(COMPONENT.xml), basename(COMPONENT.content)],
          },
        ]);

        // @ts-ignore - we need to spoof the type for this test
        dupedComponent.type = {
          ...dupedComponent.type,
          children: registryAccess.getTypeByName('customobject').children,
        };

        assert(component.xml);
        const compWriteInfo: WriteInfo = {
          output: dupedComponent.getPackageRelativePath(component.xml, 'metadata'),
          source: readableMock,
        };
        const chunkWithDupe: WriterFormat = {
          component: dupedComponent,
          writeInfos: [compWriteInfo, compWriteInfo],
        };

        // The chunk has 2 identical components. The dupe should be
        // ignored so that it only writes once to compensate for W-9614275
        await writer._write(chunkWithDupe, '', (err: Error | undefined) => {
          expect(err).to.be.undefined;
          expect(ensureFile.calledOnce).to.be.true;
          expect(pipelineStub.calledOnce).to.be.true;
          expect(loggerStub.calledOnce).to.be.true;
          const fullDest = join(rootDestination, compWriteInfo.output);
          const expectedLogMsg = `Ignoring duplicate metadata for: ${fullDest}`;
          expect(loggerStub.firstCall.args[0]).to.equal(expectedLogMsg);
        });
      });
    });

    describe('ZipWriter', () => {
      let writer: streams.ZipWriter;

      beforeEach(() => {
        env
          .stub(fs, 'createWriteStream')
          .withArgs(`${rootDestination}.zip`)
          // @ts-ignore
          .returns(fsWritableMock);
        writer = new streams.ZipWriter();
      });

      it('should add entries to zip based on given write infos', async () => {
        writer = new streams.ZipWriter(`${rootDestination}.zip`);
        const jsZipFileStub = env.stub(JSZip.prototype, 'file');
        env.stub(streams, 'stream2buffer').resolves(Buffer.from('hi'));

        await writer._write(chunk, '', (err: Error | undefined) => {
          expect(err).to.be.undefined;
        });
        // NOTE: Zips must only contain files with posix paths
        expect(jsZipFileStub.firstCall.args[0]).to.equal('classes/myComponent.cls-meta.xml');
        expect(jsZipFileStub.firstCall.args[1]).to.deep.equal(Buffer.from('hi'));
      });

      it('should add entries to zip based on given write infos when zip is in-memory only', async () => {
        writer = new streams.ZipWriter();
        const jsZipFileStub = env.stub(JSZip.prototype, 'file');
        env.stub(streams, 'stream2buffer').resolves(Buffer.from('hi'));

        await writer._write(chunk, '', (err: Error | undefined) => {
          expect(err).to.be.undefined;
        });
        expect(jsZipFileStub.firstCall.args[0]).to.equal('classes/myComponent.cls-meta.xml');
        expect(jsZipFileStub.firstCall.args[1]).to.deep.equal(Buffer.from('hi'));
      });

      it('should generateAsync zip when stream is finished', async () => {
        const generateAsyncStub = env.stub(JSZip.prototype, 'generateAsync').resolves();
        const expectedArgs = {
          type: 'nodebuffer',
          compression: 'DEFLATE',
          compressionOptions: { level: 3 },
        };

        await writer._final((err: Error | undefined) => {
          expect(err).to.be.undefined;
          expect(generateAsyncStub.calledOnce).to.be.true;
          expect(generateAsyncStub.firstCall.args[0]).to.deep.equal(expectedArgs);
        });
      });

      it('should write zip to buffer if no fs destination given', async () => {
        await writer._write(chunk, '', (err: Error | undefined) => {
          expect(err).to.be.undefined;
        });
        await writer._final(() => {
          expect(writer.buffer).to.not.be.empty;
        });
      });

      it('should pass errors to _write callback', async () => {
        const whoops = new Error('whoops!');
        env.stub(JSZip.prototype, 'file').throws(whoops);
        env.stub(streams, 'stream2buffer').resolves(Buffer.from('hi'));

        await writer._write(chunk, '', (err: Error | undefined) => {
          assert(err instanceof Error);
          expect(err.message).to.equal(whoops.message);
          expect(err.name).to.equal(whoops.name);
        });
      });

      it('should pass errors to _final callback', async () => {
        const whoops = new Error('whoops!');
        env.stub(JSZip.prototype, 'generateAsync').throws(whoops);

        await writer._final((err: Error | undefined) => {
          assert(err instanceof Error);
          expect(err.message).to.equal(whoops.message);
          expect(err.name).to.equal(whoops.name);
        });
      });
    });
  });

  describe('JsToXml', () => {
    it('should transform js object to xml string', () => {
      const xmlObj = {
        TestType: {
          [XML_NS_KEY]: XML_NS_URL,
          foo: 'bar',
          many: [{ test: 'first' }, { test: 'second' }],
        },
      };
      const jsToXml = new streams.JsToXml(xmlObj);
      let expectedBody = XML_DECL;
      expectedBody += `<TestType xmlns="${XML_NS_URL}">\n`;
      expectedBody += '    <foo>bar</foo>\n';
      expectedBody += '    <many>\n';
      expectedBody += '        <test>first</test>\n';
      expectedBody += '    </many>\n';
      expectedBody += '    <many>\n';
      expectedBody += '        <test>second</test>\n';
      expectedBody += '    </many>\n';
      expectedBody += '</TestType>\n';

      expect(jsToXml.read().toString()).to.be.equal(expectedBody);
    });

    it('should transform js object with cdata to xml string', () => {
      const xmlObj = {
        TestType: {
          [XML_NS_KEY]: XML_NS_URL,
          foo: 'bar',
          value: { __cdata: '<p>Hello</p>' },
        },
      };
      const jsToXml = new streams.JsToXml(xmlObj);
      let expectedBody = XML_DECL;
      expectedBody += `<TestType xmlns="${XML_NS_URL}">\n`;
      expectedBody += '    <foo>bar</foo>\n';
      expectedBody += '    <value>\n';
      expectedBody += '        <![CDATA[<p>Hello</p>]]>\n';
      expectedBody += '    </value>\n';
      expectedBody += '</TestType>\n';

      expect(jsToXml.read().toString()).to.be.equal(expectedBody);
    });
  });

  describe('stream2buffer', () => {
    it('returns the stream content in a buffer', async () => {
      const stream = new Readable();
      stream._read = (): void => {
        stream.push('foo');
        stream.push(null);
      };
      const buffer = await streams.stream2buffer(stream);
      expect(buffer).to.be.instanceof(Buffer);
      expect(buffer.toString()).to.equal('foo');
    });

    it('returns expected result for empty files', async () => {
      const stream = new Readable();
      stream._read = (): void => {
        stream.push(null);
      };
      const buffer = await streams.stream2buffer(stream);
      expect(buffer).to.be.instanceof(Buffer);
      expect(buffer.toString()).to.equal('');
    });
  });
});
