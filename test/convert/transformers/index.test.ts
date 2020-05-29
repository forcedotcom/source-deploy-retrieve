import { KEANU_COMPONENT } from '../../mock/registry/keanuConstants';
import { expect } from 'chai';
import { getTransformer } from '../../../src/convert/transformers';
import { DefaultTransformer } from '../../../src/convert/transformers/default';

describe('Metadata Transformers', () => {
  describe('getTransformer', () => {
    it('should return DefaultTransformer', () => {
      const component = KEANU_COMPONENT;
      expect(getTransformer(component)).to.deep.equal(new DefaultTransformer(component));
    });
  });

  require('./default');
});
