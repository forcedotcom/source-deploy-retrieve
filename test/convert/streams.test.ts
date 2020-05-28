import { ComponentReader, ComponentConverter, StandardWriter } from '../../src/convert/streams';
import { KATHY_COMPONENTS } from '../mock/registry/kathyConstants';
import { expect } from 'chai';

describe('Streams', () => {
  describe('ComponentReader', () => {
    it('Should read metadata components one at a time', async () => {
      const reader = new ComponentReader(KATHY_COMPONENTS);
      let currentIndex = 0;
      for await (const component of reader) {
        expect(component).to.deep.equal(KATHY_COMPONENTS[currentIndex]);
        currentIndex += 1;
      }
    });
  });

  describe('ComponentConverter', () => {
    const component = KATHY_COMPONENTS[0];
    it('Should wrap errors in a ConversionError object', () => {});

    it('Should transform to metadata format', () => {});

    it('Should transform to source format', () => {});
  });

  describe('StandardWriter', () => {
    it('Should wrap errors in a ConversionError object', () => {});

    it('Should write files to directory according to chunk data', () => {});
  });
});
