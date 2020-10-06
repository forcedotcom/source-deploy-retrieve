/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import * as archiver from 'archiver';
import * as streams from '../../src/convert/streams';
import * as fsUtil from '../../src/utils/fileSystemHandler';
import { expect } from 'chai';
import { join } from 'path';
import { createSandbox, SinonStub } from 'sinon';
import { Readable, Writable } from 'stream';
import { SourceComponent } from '../../src';
import { MetadataTransformer, WriterFormat } from '../../src/convert';
import { ConvertTransaction } from '../../src/convert/convertTransaction';
import { MetadataTransformerFactory } from '../../src/convert/transformers';
import { LibraryError } from '../../src/errors';
import { XML_NS_KEY, XML_NS, XML_DECL } from '../../src/utils/constants';
import {
  TestFinalizerNoResult,
  TestFinalizerNoWrites,
  TestFinalizerMultipleFormatsNoWrites,
} from '../mock/convert/finalizers';
import { mockRegistry } from '../mock/registry';
import { KATHY_COMPONENTS } from '../mock/registry/kathyConstants';

const env = createSandbox();

class TestTransformer implements MetadataTransformer {
  private component: SourceComponent;
  constructor(component: SourceComponent) {
    this.component = component;
  }
  async toMetadataFormat(): Promise<WriterFormat> {
    return {
      component: this.component,
      writeInfos: [{ relativeDestination: '/type/file.m', source: new Readable() }],
    };
  }
  async toSourceFormat(): Promise<WriterFormat> {
    return {
      component: this.component,
      writeInfos: [{ relativeDestination: '/type/file.s', source: new Readable() }],
    };
  }
}

describe('Streams', () => {
  afterEach(() => env.restore());

  describe('ComponentReader', () => {
    it('should read metadata components one at a time', async () => {
      const reader = new streams.ComponentReader(KATHY_COMPONENTS);
      let currentIndex = 0;
      for await (const component of reader) {
        expect(component).to.deep.equal(KATHY_COMPONENTS[currentIndex]);
        currentIndex += 1;
      }
      expect(currentIndex).to.equal(KATHY_COMPONENTS.length);
    });
  });

  describe('ComponentConverter', () => {
    const component = KATHY_COMPONENTS[0];
    const transformer = new TestTransformer(component);

    beforeEach(() => {
      env
        .stub(MetadataTransformerFactory.prototype, 'getTransformer')
        .withArgs(component)
        .returns(transformer);
    });

    it('should throw error for unexpected conversion format', () => {
      // @ts-ignore constructor argument invalid
      const converter = new streams.ComponentConverter('badformat', mockRegistry);
      converter._transform(component, '', (err: Error) => {
        const expectedError = new LibraryError('error_convert_invalid_format', 'badformat');
        expect(err.message).to.equal(expectedError.message);
        expect(err.name).to.equal(expectedError.name);
      });
    });

    it('should transform to metadata format', () => {
      const converter = new streams.ComponentConverter('metadata', mockRegistry);

      converter._transform(component, '', async (err: Error, data: WriterFormat) => {
        expect(err).to.be.undefined;
        expect(data).to.deep.equal(await transformer.toMetadataFormat());
      });
    });

    it('should transform to source format', () => {
      const converter = new streams.ComponentConverter('source', mockRegistry);

      converter._transform(component, '', async (err: Error, data: WriterFormat) => {
        expect(err).to.be.undefined;
        expect(data).to.deep.equal(await transformer.toSourceFormat());
      });
    });

    describe('Transaction Finalizers', () => {
      let converter: streams.ComponentConverter;
      let transaction: ConvertTransaction;

      beforeEach(() => {
        transaction = new ConvertTransaction();
        converter = new streams.ComponentConverter('metadata', mockRegistry, transaction);
      });

      it('should not push a result if finalize did not return one', () => {
        const pushStub = env.stub(converter, 'push');
        transaction.addFinalizer(TestFinalizerNoResult);

        converter._flush((err) => expect(err).to.be.undefined);

        expect(pushStub.notCalled).to.be.true;
      });

      it('should flush one result from a single transaction finalizer', async () => {
        const finalizer = new TestFinalizerNoWrites();
        const pushStub = env.stub(converter, 'push');
        transaction.addFinalizer(TestFinalizerNoWrites);

        await converter._flush((err) => expect(err).to.be.undefined);

        expect(pushStub.calledOnce).to.be.true;
        expect(pushStub.calledOnceWith(await finalizer.finalize())).to.be.true;
      });

      it('should flush multiple results from a single transaction finalizer', async () => {
        const pushStub = env.stub(converter, 'push');
        const results = await new TestFinalizerMultipleFormatsNoWrites().finalize();
        transaction.addFinalizer(TestFinalizerMultipleFormatsNoWrites);

        await converter._flush((err) => expect(err).to.be.undefined);

        expect(pushStub.calledTwice).to.be.true;
        expect(pushStub.getCall(0).calledWith(results[0])).to.be.true;
        expect(pushStub.getCall(1).calledWith(results[1])).to.be.true;
      });

      it('should pass error to callback if a problem occurred', () => {
        const expectedError = new Error('whoops');
        env.stub(transaction, 'executeFinalizers').throws(expectedError);

        converter._flush((err: Error) => expect(err).to.deep.equal(expectedError));
      });
    });
  });

  describe('ComponentWriters', () => {
    const rootDestination = join('path', 'to', 'test-package');
    const relativeDestination = join('type', 'file.x');
    const fullPath = join(rootDestination, relativeDestination);
    const fsWritableMock = new Writable();
    const readableMock = new Readable();
    readableMock._read = (): void => {
      readableMock.push('hi');
      readableMock.push(null);
    };
    const chunk: WriterFormat = {
      component: KATHY_COMPONENTS[0],
      writeInfos: [
        {
          relativeDestination,
          source: readableMock,
        },
      ],
    };

    let pipelineStub: SinonStub;

    describe('StandardWriter', () => {
      const writer = new streams.StandardWriter(rootDestination);

      let ensureFile: SinonStub;

      beforeEach(() => {
        ensureFile = env.stub(fsUtil, 'ensureFileExists');
        pipelineStub = env.stub(streams, 'pipeline');
        env
          .stub(fs, 'createWriteStream')
          .withArgs(fullPath)
          // @ts-ignore
          .returns(fsWritableMock);
      });

      it('should pass errors to _write callback', async () => {
        const whoops = new Error('whoops!');
        pipelineStub.rejects(whoops);

        await writer._write(chunk, '', (err: Error) => {
          expect(err.message).to.equal(whoops.message);
          expect(err.name).to.equal(whoops.name);
        });
      });

      it('should perform file copies based on given write infos', async () => {
        pipelineStub.resolves();

        const extraChunk: WriterFormat = {
          component: KATHY_COMPONENTS[0],
          writeInfos: [
            {
              relativeDestination,
              source: readableMock,
            },
          ],
          getExtraInfos: async () => [
            {
              relativeDestination: join('testdata', 'images', 'a.1'),
              source: readableMock,
            },
          ],
        };

        await writer._write(extraChunk, '', (err: Error) => {
          expect(err).to.be.undefined;
          expect(ensureFile.firstCall.args).to.deep.equal([
            join(rootDestination, 'testdata', 'images', 'a.1'),
          ]);
        });
      });

      it('should use extra info when available', async () => {
        pipelineStub.resolves();

        await writer._write(chunk, '', (err: Error) => {
          expect(err).to.be.undefined;
          expect(ensureFile.firstCall.args).to.deep.equal([fullPath]);
          expect(pipelineStub.firstCall.args).to.deep.equal([
            chunk.writeInfos[0].source,
            fsWritableMock,
          ]);
        });
      });
    });

    describe('ZipWriter', () => {
      let archive: archiver.Archiver;
      let writer: streams.ZipWriter;

      beforeEach(() => {
        archive = archiver.create('zip', { zlib: { level: 3 } });
        env.stub(archiver, 'create').returns(archive);
        env
          .stub(fs, 'createWriteStream')
          .withArgs(`${rootDestination}.zip`)
          // @ts-ignore
          .returns(fsWritableMock);
        writer = new streams.ZipWriter();
      });

      it('should add entries to zip based on given write infos', async () => {
        writer = new streams.ZipWriter(`${rootDestination}.zip`);
        const appendStub = env.stub(archive, 'append');

        await writer._write(chunk, '', (err: Error) => {
          expect(err).to.be.undefined;
          expect(appendStub.firstCall.args).to.deep.equal([
            chunk.writeInfos[0].source,
            { name: chunk.writeInfos[0].relativeDestination },
          ]);
        });
      });

      it('should finalize zip when stream is finished', async () => {
        const finalizeStub = env.stub(archive, 'finalize').resolves();

        await writer._final((err: Error) => {
          expect(err).to.be.undefined;
          expect(finalizeStub.calledOnce).to.be.true;
        });
      });

      it('should write zip to buffer if no fs destination given', async () => {
        await writer._write(chunk, '', (err: Error) => {
          expect(err).to.be.undefined;
        });
        await writer._final(() => {
          expect(writer.buffer).to.not.be.empty;
        });
      });

      it('should pass errors to _write callback', async () => {
        const whoops = new Error('whoops!');
        env.stub(archive, 'append').throws(whoops);

        await writer._write(chunk, '', (err: Error) => {
          expect(err.message).to.equal(whoops.message);
          expect(err.name).to.equal(whoops.name);
        });
      });

      it('should pass errors to _final callback', async () => {
        const whoops = new Error('whoops!');
        env.stub(archive, 'finalize').throws(whoops);

        await writer._final((err: Error) => {
          expect(err.message).to.equal(whoops.message);
          expect(err.name).to.equal(whoops.name);
        });
      });

      it('should use extra info when available', async () => {
        writer = new streams.ZipWriter(`${rootDestination}.zip`);
        const appendStub = env.stub(archive, 'append');

        const extraChunk: WriterFormat = {
          component: KATHY_COMPONENTS[0],
          writeInfos: [
            {
              relativeDestination,
              source: readableMock,
            },
          ],
          getExtraInfos: async () => [
            {
              relativeDestination: join('testdata', 'images', 'a.1'),
              source: readableMock,
            },
          ],
        };

        await writer._write(extraChunk, '', (err: Error) => {
          expect(err).to.be.undefined;
          expect(appendStub.firstCall.args).to.deep.equal([
            extraChunk.writeInfos[0].source,
            { name: join('testdata', 'images', 'a.1') },
          ]);
        });
      });
    });
  });

  describe('JsToXml', () => {
    it('should transform js object to xml string', () => {
      const xmlObj = {
        TestType: {
          [XML_NS_KEY]: XML_NS,
          foo: 'bar',
          many: [{ test: 'first' }, { test: 'second' }],
        },
      };
      const jsToXml = new streams.JsToXml(xmlObj);
      let expectedBody = XML_DECL;
      expectedBody += `<TestType xmlns="${XML_NS}">\n`;
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
  });
});
