import { walk, isDirectory } from '../../src/utils/fileSystemHandler';
import { SinonStub, createSandbox } from 'sinon';
import { expect } from 'chai';
import { join } from 'path';
import * as fs from 'fs';

const env = createSandbox();

describe('File System Utils', () => {
  const root = join('path', 'to', 'whatever');

  describe('walk', () => {
    let readStub: SinonStub;
    let statStub: SinonStub;

    beforeEach(() => {
      readStub = env.stub(fs, 'readdirSync');
      statStub = env.stub(fs, 'lstatSync');
    });
    afterEach(() => env.restore());

    const files = ['a.x', 'b.y', 'c.z'];

    it('Should collect all files in single level directory', () => {
      statStub.returns({ isDirectory: () => false });
      readStub.withArgs(root).returns(files);

      expect(walk(root)).to.deep.equal(files.map(f => join(root, f)));
    });

    it('Should collect files in nested directories', () => {
      const l1Files = files.concat(['d']);
      const l2Files = ['aperture science', 'e.t', 'hello_world.js'];
      const l3Files = ['theCakeIsALie.glados'];
      const dPath = join(root, 'd');
      const aperturePath = join(dPath, 'aperture science');
      readStub.withArgs(root).returns(l1Files);
      readStub.withArgs(dPath).returns(l2Files);
      readStub.withArgs(aperturePath).returns(l3Files);
      statStub.returns({ isDirectory: () => false });
      statStub.withArgs(dPath).returns({ isDirectory: () => true });
      statStub.withArgs(aperturePath).returns({ isDirectory: () => true });

      expect(walk(root)).to.deep.equal([
        join(root, 'a.x'),
        join(root, 'b.y'),
        join(root, 'c.z'),
        join(aperturePath, 'theCakeIsALie.glados'),
        join(dPath, 'e.t'),
        join(dPath, 'hello_world.js')
      ]);
    });

    it('Should ignore specified paths', () => {
      statStub.returns({ isDirectory: () => false });
      readStub.withArgs(root).returns(files);
      const ignore = new Set([join(root, 'b.y')]);

      expect(walk(root, ignore)).to.deep.equal([
        join(root, 'a.x'),
        join(root, 'c.z')
      ]);
    });
  });

  describe('isDirectory', () => {
    it('Should utilize fs Stats to determine if path is a directory', () => {
      const statStub = env.stub(fs, 'lstatSync');
      // @ts-ignore
      statStub.withArgs(root).returns({ isDirectory: () => true });
      expect(isDirectory(root)).to.be.true;
    });
  });
});
