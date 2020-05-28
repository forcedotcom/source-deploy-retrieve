import * as streams from '../../src/convert/streams';
import { KATHY_COMPONENTS } from '../mock/registry/kathyConstants';
import { expect } from 'chai';
import * as transformers from '../../src/convert/transformers';
import { createSandbox, SinonStub } from 'sinon';
import { WriterFormat, MetadataTransformer, MetadataComponent } from '../../src/types';
import { Readable, Writable } from 'stream';
import { ConversionError, LibraryError } from '../../src/errors';
import * as fsUtil from '../../src/utils/fileSystemHandler';
import * as fs from 'fs';
import { join } from 'path';

const env = createSandbox();

class TestTransformer implements MetadataTransformer {
  private component: MetadataComponent;
  constructor(component: MetadataComponent) {
    this.component = component;
  }
  toMetadataFormat(): WriterFormat {
    return {
      component: this.component,
      writeInfos: [{ relativeDestination: '/type/file.m', source: new Readable() }]
    };
  }
  toSourceFormat(): WriterFormat {
    return {
      component: this.component,
      writeInfos: [{ relativeDestination: '/type/file.s', source: new Readable() }]
    };
  }
}

describe('Streams', () => {
  afterEach(() => env.restore());

  describe('ComponentReader', () => {
    it('Should read metadata components one at a time', async () => {
      const reader = new streams.ComponentReader(KATHY_COMPONENTS);
      let currentIndex = 0;
      for await (const component of reader) {
        expect(component).to.deep.equal(KATHY_COMPONENTS[currentIndex]);
        currentIndex += 1;
      }
    });
  });

  describe('ComponentConverter', () => {
    const component = KATHY_COMPONENTS[0];
    const transformer = new TestTransformer(component);

    beforeEach(() => {
      env.stub(transformers, 'getTransformer').returns(transformer);
    });

    it('Should wrap errors in a ConversionError object', () => {
      // @ts-ignore thank you ts, but i want this to fail
      const converter = new streams.ComponentConverter('badformat');
      converter._transform(component, '', (err: Error) => {
        const expectedError = new ConversionError(
          new LibraryError('error_convert_invalid_format', 'badformat')
        );
        expect(err.message).to.equal(expectedError.message);
      });
    });

    it('Should transform to metadata format', () => {
      const converter = new streams.ComponentConverter('metadata');

      converter._transform(component, '', (err: Error, data: WriterFormat) => {
        expect(err).to.be.undefined;
        expect(data).to.deep.equal(transformer.toMetadataFormat());
      });
    });

    it('Should transform to source format', () => {
      const converter = new streams.ComponentConverter('source');

      converter._transform(component, '', (err: Error, data: WriterFormat) => {
        expect(err).to.be.undefined;
        expect(data).to.deep.equal(transformer.toSourceFormat());
      });
    });
  });

  describe('StandardWriter', () => {
    const packageRoot = join('path', 'to', 'test-package');
    const relativeDestination = join('type', 'file.x');
    const fullPath = join(packageRoot, relativeDestination);
    const fsWritableMock = new Writable();
    const chunk: WriterFormat = {
      component: KATHY_COMPONENTS[0],
      writeInfos: [
        {
          relativeDestination,
          source: new Readable()
        }
      ]
    };

    const writer = new streams.StandardWriter(packageRoot);

    let ensureFile: SinonStub;
    let pipeline: SinonStub;

    beforeEach(() => {
      ensureFile = env.stub(fsUtil, 'ensureFileExists');
      pipeline = env.stub(streams, 'pipeline');
      env
        .stub(fs, 'createWriteStream')
        .withArgs(fullPath)
        // @ts-ignore
        .returns(fsWritableMock);
    });

    it('Should wrap errors in a ConversionError object', async () => {
      const whoops = new Error('whoops!');
      pipeline.rejects(whoops);

      await writer._write(chunk, '', (err: Error) => {
        const expectedError = new ConversionError(whoops);
        expect(err.message).to.equal(expectedError.message);
      });
    });

    it('Should perform file copies based on given write infos', async () => {
      pipeline.resolves();

      await writer._write(chunk, '', (err: Error) => {
        expect(err).to.be.undefined;
        expect(ensureFile.firstCall.args).to.deep.equal([fullPath]);
        expect(pipeline.firstCall.args).to.deep.equal([chunk.writeInfos[0].source, fsWritableMock]);
      });
    });
  });
});
