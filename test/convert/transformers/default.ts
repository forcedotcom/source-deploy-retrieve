import { simon, kathy, keanu } from '../../mock/registry';
import { DefaultTransformer } from '../../../src/convert/transformers/default';
import { WriteInfo } from '../../../src/types';
import { join, basename } from 'path';
import { createSandbox } from 'sinon';
import { Readable } from 'stream';
import * as fs from 'fs';
import { expect, assert } from 'chai';
import { LibraryError } from '../../../src/errors';
import { nls } from '../../../src/i18n';

const env = createSandbox();

class TestReadable extends Readable {
  private path: string;
  constructor(path: string) {
    super();
    this.path = path;
  }
}

describe('DefaultTransformer', () => {
  beforeEach(() =>
    // @ts-ignore
    env.stub(fs, 'createReadStream').callsFake((fsPath: string) => new TestReadable(fsPath))
  );

  afterEach(() => env.restore());

  describe('toMetadataFormat', () => {
    it('should create a WriteInfo for each file in the component', () => {
      const component = simon.SIMON_COMPONENT;
      const transformer = new DefaultTransformer(component);
      const { directoryName } = component.type;
      const relativeBundle = join(directoryName, basename(simon.SIMON_BUNDLE_PATH));
      const expectedInfos: WriteInfo[] = [
        {
          relativeDestination: join(relativeBundle, simon.SIMON_XML_NAME),
          source: fs.createReadStream(component.xml)
        }
      ];
      for (const source of component.sources) {
        expectedInfos.push({
          relativeDestination: join(relativeBundle, basename(source)),
          source: fs.createReadStream(source)
        });
      }

      expect(transformer.toMetadataFormat()).to.deep.equal({
        component,
        writeInfos: expectedInfos
      });
    });

    it('should handle folder type components', () => {
      const component = kathy.KATHY_COMPONENTS[0];
      const transformer = new DefaultTransformer(component);
      const { directoryName } = component.type;
      const fileName = `${component.fullName}.${component.type.suffix}`;
      const expectedInfos: WriteInfo[] = [
        {
          relativeDestination: join(directoryName, fileName),
          source: fs.createReadStream(component.xml)
        }
      ];

      expect(transformer.toMetadataFormat()).to.deep.equal({
        component,
        writeInfos: expectedInfos
      });
    });

    it('should strip the -meta.xml suffix for components with no content', () => {
      const component = keanu.KEANU_COMPONENT;
      const { directoryName } = component.type;
      const transformer = new DefaultTransformer(component);
      const expectedInfos: WriteInfo[] = [
        {
          relativeDestination: join(directoryName, keanu.KEANU_XML_NAMES[0]),
          source: fs.createReadStream(component.xml)
        },
        {
          relativeDestination: join(directoryName, keanu.KEANU_SOURCE_NAMES[0]),
          source: fs.createReadStream(component.sources[0])
        }
      ];

      expect(transformer.toMetadataFormat()).to.deep.equal({
        component,
        writeInfos: expectedInfos
      });
    });
  });

  describe('toSourceFormat', () => {
    it('should throw an not implemented error', () => {
      const component = simon.SIMON_COMPONENT;
      const transformer = new DefaultTransformer(component);
      assert.throws(
        () => transformer.toSourceFormat(),
        LibraryError,
        nls.localize('error_convert_not_implemented', ['source', component.type.name])
      );
    });
  });
});
