/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  BaseTreeContainer,
  NodeFSTreeContainer,
  VirtualTreeContainer
} from '../../src/metadata-registry/treeContainers';
import { expect, assert } from 'chai';
import { createSandbox } from 'sinon';
import * as fs from 'fs';
import { join } from 'path';
import { LibraryError } from '../../src/errors';
import { nls } from '../../src/i18n';

describe('Tree Containers', () => {
  const readDirResults = ['a.q', 'a.x-meta.xml', 'b', 'b.x-meta.xml', 'c.z', 'c.x-meta.xml'];

  describe('BaseTreeContainer', () => {
    class TestTreeContainer extends BaseTreeContainer {
      readDirectory(): string[] {
        return readDirResults;
      }

      exists(): boolean {
        return false;
      }

      isDirectory(): boolean {
        return false;
      }
    }
    const tree = new TestTreeContainer();

    it('should find first matching metadata file', () => {
      expect(tree.find('metadata', 'b', '')).to.equal('b.x-meta.xml');
    });

    it('should find first matching content file', () => {
      expect(tree.find('content', 'c', '')).to.equal('c.z');
    });
  });

  describe('NodeFSTreeContainer', () => {
    const env = createSandbox();
    const tree = new NodeFSTreeContainer();
    const path = join('path', 'to', 'test');

    afterEach(() => env.restore());

    it('should use expected Node API for isDirectory', () => {
      const statStub = env.stub(fs, 'lstatSync');
      // @ts-ignore lstat returns more than isDirectory function
      statStub.withArgs(path).returns({ isDirectory: () => true });
      expect(tree.isDirectory(path)).to.be.true;
      expect(statStub.calledOnce).to.be.true;
    });

    it('should use expected Node API for exists', () => {
      const existsStub = env.stub(fs, 'existsSync');
      existsStub.withArgs(path).returns(true);
      expect(tree.exists(path)).to.be.true;
      expect(existsStub.calledOnce).to.be.true;
    });

    it('should use expected Node API for readDirectory', () => {
      const readdirStub = env.stub(fs, 'readdirSync');
      // @ts-ignore wants Dirents but string[] works as well
      readdirStub.withArgs(path).returns(readDirResults);
      expect(tree.readDirectory(path)).to.deep.equal(readDirResults);
      expect(readdirStub.calledOnce).to.be.true;
    });
  });

  describe('VirtualTreeContainer', () => {
    const virtualFS = [
      {
        path: '.',
        children: ['test.txt', 'test2.txt', 'files']
      },
      {
        path: join('.', 'files'),
        children: ['test3.txt']
      }
    ];
    const tree = new VirtualTreeContainer(virtualFS);

    describe('isDirectory', () => {
      it('should return false for isDirectory', () => {
        const path = join('.', 'test.txt');
        expect(tree.isDirectory(path)).to.be.false;
      });

      it('should return true for isDirectory', () => {
        const path = join('.', 'files');
        expect(tree.isDirectory(path)).to.be.true;
      });

      it('should throw an error if path does not exist', () => {
        const path = 'dne';
        assert.throws(
          () => tree.isDirectory(path),
          LibraryError,
          nls.localize('error_path_not_found', path)
        );
      });
    });

    describe('exists', () => {
      it('should return true for file that exists', () => {
        const path = join('.', 'test.txt');
        expect(tree.exists(path)).to.be.true;
      });

      it('should return true for directory that exists', () => {
        const path = join('.', 'files');
        expect(tree.exists(path)).to.be.true;
      });

      it('should return false for file that does not exist', () => {
        const path = join('.', 'files', 'text4.txt');
        expect(tree.exists(path)).to.be.false;
      });

      it('should return false for directory that does not exist', () => {
        const path = join('.', 'otherfiles');
        expect(tree.exists(path)).to.be.false;
      });
    });

    it('should return directory entries for readDirectory', () => {
      expect(tree.readDirectory('.')).to.deep.equal(virtualFS[0].children);
    });
  });
});
