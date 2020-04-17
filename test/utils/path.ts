import { join } from 'path';
import { expect } from 'chai';
import { baseName } from '../../src/utils/path';

describe('Path Utils', () => {
  const root = join('path', 'to', 'whatever');

  describe('baseName', () => {
    it('Should strip all suffixes of a file path and return just the name', () => {
      const path = join(root, 'a.ext.xyz');
      expect(baseName(path)).to.equal('a');
    });

    it('Should handle paths with no suffixes', () => {
      const path = join(root, 'a');
      expect(baseName(path)).to.equal('a');
    });
  });
});
