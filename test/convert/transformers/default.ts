import { simon } from '../../mock/registry';
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
  const component = simon.SIMON_COMPONENT;
  const transformer = new DefaultTransformer(component);

  describe('toMetadataFormat', () => {
    it('Should create a WriteInfo for each file in the component', () => {
      const { directoryName } = component.type;
      const relativeBundle = join(directoryName, basename(simon.SIMON_BUNDLE_PATH));
      // @ts-ignore
      env.stub(fs, 'createReadStream').callsFake((fsPath: string) => new TestReadable(fsPath));
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
  });

  describe('toSourceFormat', () => {
    it('Should throw an not implemented error', () => {
      assert.throws(
        () => transformer.toSourceFormat(),
        LibraryError,
        nls.localize('error_convert_not_implemented', ['source', component.type.name])
      );
    });
  });
});
