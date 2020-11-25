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
import { basename, dirname, join, sep } from 'path';
import { createSandbox, SinonStub } from 'sinon';
import { Readable, Writable } from 'stream';
import { ComponentSet, MetadataResolver, SourceComponent } from '../../src';
import { MetadataTransformer, WriterFormat } from '../../src/convert';
import { ConvertTransaction } from '../../src/convert/convertTransaction';
import { MetadataTransformerFactory } from '../../src/convert/transformers';
import { LibraryError } from '../../src/errors';
import {
  TestFinalizerNoResult,
  TestFinalizerNoWrites,
  TestFinalizerMultipleFormatsNoWrites,
} from '../mock/convert/finalizers';
import { mockRegistry } from '../mock/registry';
import { KATHY_COMPONENTS } from '../mock/registry/kathyConstants';
import { XML_NS_URL, XML_DECL, XML_NS_KEY } from '../../src/common';
import {
  KEANUS_DIR,
  KEANU_COMPONENT,
  KEANU_SOURCE_NAMES,
  KEANU_XML_NAMES,
} from '../mock/registry/keanuConstants';

const env = createSandbox();

class TestTransformer implements MetadataTransformer {
  async toMetadataFormat(component: SourceComponent): Promise<WriterFormat> {
    return {
      component,
      writeInfos: [{ output: '/type/file.m', source: new Readable() }],
    };
  }
  async toSourceFormat(
    component: SourceComponent,
    mergeWith?: SourceComponent
  ): Promise<WriterFormat> {
    const output = mergeWith ? mergeWith.content || mergeWith.xml : '/type/file.s';
    return {
      component,
      writeInfos: [{ output, source: new Readable() }],
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

  /**
   * NOTE: tests that call _transform methods must utilize Mocha.done to signal
   * when a test has finished and to pass on any assertion failures to the test
   * runner. Otherwise a test may fail but signal that it was successful.
   */
  describe('ComponentConverter', () => {
    const component = KATHY_COMPONENTS[0];
    const transformer = new TestTransformer();

    beforeEach(() => {
      env.stub(MetadataTransformerFactory.prototype, 'getTransformer').returns(transformer);
    });

    it('should throw error for unexpected conversion format', (done) => {
      // @ts-ignore constructor argument invalid
      const converter = new streams.ComponentConverter('badformat', mockRegistry);
      const expectedError = new LibraryError('error_convert_invalid_format', 'badformat');

      converter._transform(component, '', (err: Error) => {
        try {
          expect(err.message).to.equal(expectedError.message);
          expect(err.name).to.equal(expectedError.name);
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it('should transform to metadata format', (done) => {
      const converter = new streams.ComponentConverter('metadata', mockRegistry);

      converter._transform(component, '', async (err: Error, data: WriterFormat) => {
        try {
          expect(err).to.be.undefined;
          expect(data).to.deep.equal(await transformer.toMetadataFormat(component));
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it('should transform to source format', (done) => {
      const converter = new streams.ComponentConverter('source', mockRegistry);

      converter._transform(component, '', async (err: Error, data: WriterFormat) => {
        try {
          expect(err).to.be.undefined;
          expect(data).to.deep.equal(await transformer.toSourceFormat(component));
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
      const converter = new streams.ComponentConverter('source', mockRegistry, undefined, mergeSet);

      converter._transform(newComponent, '', async (err: Error, data: WriterFormat) => {
        try {
          expect(err).to.be.undefined;
          expect(data).to.deep.equal(await transformer.toSourceFormat(newComponent, component));
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    describe('Transaction Finalizers', () => {
      let converter: streams.ComponentConverter;
      let transaction: ConvertTransaction;

      beforeEach(() => {
        transaction = new ConvertTransaction();
        converter = new streams.ComponentConverter('metadata', mockRegistry, transaction);
      });

      it('should not push a result if finalize did not return one', async () => {
        const pushStub = env.stub(converter, 'push');
        transaction.addFinalizer(TestFinalizerNoResult);

        await converter._flush((err) => expect(err).to.be.undefined);

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

      it('should pass error to callback if a problem occurred', async () => {
        const expectedError = new Error('whoops');
        env.stub(transaction, 'executeFinalizers').throws(expectedError);

        await converter._flush((err: Error) => expect(err).to.deep.equal(expectedError));
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
    const component = SourceComponent.createVirtualComponent(KEANU_COMPONENT, [
      {
        dirPath: KEANUS_DIR,
        children: KEANU_XML_NAMES.concat(KEANU_SOURCE_NAMES),
      },
      {
        dirPath: join(rootDestination, KEANU_COMPONENT.type.directoryName),
        children: [basename(KEANU_COMPONENT.xml), basename(KEANU_COMPONENT.content)],
      },
      {
        dirPath: join(absoluteRootDestination, KEANU_COMPONENT.type.directoryName),
        children: [basename(KEANU_COMPONENT.xml), basename(KEANU_COMPONENT.content)],
      },
    ]);
    const chunk: WriterFormat = {
      component: component,
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
          output: join(
            absoluteRootDestination,
            component.getPackageRelativePath(component.xml, 'metadata')
          ),
          source: readableMock,
        },
      ],
    };

    let pipelineStub: SinonStub;

    describe('StandardWriter', () => {
      const resolver = new MetadataResolver(mockRegistry, chunk.component.tree);
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

        await writer._write(chunk, '', (err: Error) => {
          expect(err.message).to.equal(whoops.message);
          expect(err.name).to.equal(whoops.name);
        });
      });

      it('should join root destination and relative WriteInfo outputs during copy', async () => {
        pipelineStub.resolves();
        const root = join(rootDestination, KEANU_COMPONENT.type.directoryName);

        await writer._write(chunk, '', (err: Error) => {
          expect(err).to.be.undefined;
          expect(ensureFile.firstCall.args[0]).to.equal(join(root, basename(KEANU_COMPONENT.xml)));
          expect(ensureFile.secondCall.args[0]).to.equal(
            join(root, basename(KEANU_COMPONENT.content))
          );
          expect(pipelineStub.firstCall.args).to.deep.equal([
            chunk.writeInfos[0].source,
            fsWritableMock,
          ]);
        });
      });

      it('should use full paths of WriteInfo output if they are absolute during copy', async () => {
        pipelineStub.resolves();

        const formatWithAbsoluteOutput: WriterFormat = {
          component: component,
          writeInfos: [
            {
              source: readableMock,
              output: join(
                absoluteRootDestination,
                component.getPackageRelativePath(component.xml, 'metadata')
              ),
            },
            {
              source: readableMock,
              output: join(
                absoluteRootDestination,
                component.getPackageRelativePath(component.content, 'metadata')
              ),
            },
          ],
        };

        await writer._write(formatWithAbsoluteOutput, '', (err: Error) => {
          expect(err).to.be.undefined;
          expect(ensureFile.firstCall.args).to.deep.equal([
            formatWithAbsoluteOutput.writeInfos[0].output,
          ]);
          expect(ensureFile.secondCall.args).to.deep.equal([
            formatWithAbsoluteOutput.writeInfos[1].output,
          ]);
          expect(pipelineStub.firstCall.args).to.deep.equal([
            formatWithAbsoluteOutput.writeInfos[0].source,
            fsWritableMock,
          ]);
        });
      });

      it('should resolve copied source components during write', async () => {
        pipelineStub.resolves();

        await writer._write(chunk, '', (err: Error) => {
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

        await writer._write(emptyChunk, '', (err: Error) => {
          expect(err).to.be.undefined;
          expect(ensureFile.notCalled).to.be.true;
          expect(pipelineStub.notCalled).to.be.true;
          expect(resolverSpy.notCalled).to.be.true;
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
            { name: chunk.writeInfos[0].output },
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
  });
});
