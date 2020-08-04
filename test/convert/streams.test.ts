/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as streams from '../../src/convert/streams';
import { KATHY_COMPONENTS } from '../mock/registry/kathyConstants';
import { expect } from 'chai';
import { createSandbox, SinonStub } from 'sinon';
import { WriterFormat, MetadataTransformer } from '../../src/types';
import { Readable, Writable } from 'stream';
import { LibraryError } from '../../src/errors';
import * as fsUtil from '../../src/utils/fileSystemHandler';
import * as fs from 'fs';
import { join } from 'path';
import * as archiver from 'archiver';
import { SourceComponent } from '../../src/metadata-registry';
import { mockRegistry } from '../mock/registry';
import { MetadataTransformerFactory } from '../../src/convert/transformers';
import { ConvertTransaction } from '../../src/convert/convertTransaction';
import {
  TestFinalizerNoWrites,
  TestFinalizerMultipleFormatsNoWrites,
  TestFinalizerNoResult,
} from '../mock/convert/finalizers';

const env = createSandbox();

class TestTransformer implements MetadataTransformer {
  private component: SourceComponent;
  constructor(component: SourceComponent) {
    this.component = component;
  }
  toMetadataFormat(): WriterFormat {
    return {
      component: this.component,
      writeInfos: [{ relativeDestination: '/type/file.m', source: new Readable() }],
    };
  }
  toSourceFormat(): WriterFormat {
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

      converter._transform(component, '', (err: Error, data: WriterFormat) => {
        expect(err).to.be.undefined;
        expect(data).to.deep.equal(transformer.toMetadataFormat());
      });
    });

    it('should transform to source format', () => {
      const converter = new streams.ComponentConverter('source', mockRegistry);

      converter._transform(component, '', (err: Error, data: WriterFormat) => {
        expect(err).to.be.undefined;
        expect(data).to.deep.equal(transformer.toSourceFormat());
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

      it('should flush one result from a single transaction finalizer', () => {
        const finalizer = new TestFinalizerNoWrites();
        const pushStub = env.stub(converter, 'push');
        transaction.addFinalizer(TestFinalizerNoWrites);

        converter._flush((err) => expect(err).to.be.undefined);

        expect(pushStub.calledOnce).to.be.true;
        expect(pushStub.calledOnceWith(finalizer.finalize())).to.be.true;
      });

      it('should flush multiple results from a single transaction finalizer', () => {
        const pushStub = env.stub(converter, 'push');
        const results = new TestFinalizerMultipleFormatsNoWrites().finalize();
        transaction.addFinalizer(TestFinalizerMultipleFormatsNoWrites);

        converter._flush((err) => expect(err).to.be.undefined);

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
    });
  });
});
