/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable class-methods-use-this */

import { join, normalize } from 'path';
import { pipeline as cbPipeline, Readable, Writable } from 'stream';
import { promisify } from 'util';
import { Messages, SfError } from '@salesforce/core';
import { assert, expect } from 'chai';
import { createSandbox } from 'sinon';
import * as fs from 'graceful-fs';
import * as unzipper from 'unzipper';
import { create as createArchive } from 'archiver';
import {
  MetadataResolver,
  NodeFSTreeContainer,
  TreeContainer,
  VirtualDirectory,
  VirtualTreeContainer,
  ZipTreeContainer,
} from '../../src';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

describe('Tree Containers', () => {
  const readDirResults = ['a.q', 'a.x-meta.xml', 'b', 'b.x-meta.xml', 'c.z', 'c.x-meta.xml'];

  describe('TreeContainer Base Class', () => {
    class TestTreeContainer extends TreeContainer {
      public readDirectory(): string[] {
        return readDirResults;
      }

      public exists(): boolean {
        return false;
      }

      public isDirectory(): boolean {
        return false;
      }

      public readFile(): Promise<Buffer> {
        return Promise.resolve(Buffer.from(''));
      }

      public readFileSync(): Buffer {
        return Buffer.from('');
      }

      public stream(): Readable {
        // @ts-expect-error it's a mock!
        return;
      }
    }
    const tree = new TestTreeContainer();

    it('should find first matching metadata file', () => {
      expect(tree.find('metadataXml', 'b', '')).to.equal('b.x-meta.xml');
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

    it('should use expected Node API for exists', () => {
      const existsStub = env.stub(fs, 'existsSync');
      existsStub.withArgs(path).returns(true);
      expect(tree.exists(path)).to.be.true;
      expect(existsStub.calledOnce).to.be.true;
    });

    it('should use expected Node API for isDirectory', () => {
      const statStub = env.stub(fs, 'statSync');
      // @ts-ignore lstat returns more than isDirectory function
      statStub.withArgs(path).returns({ isDirectory: () => true });
      expect(tree.isDirectory(path)).to.be.true;
      expect(statStub.calledOnce).to.be.true;
    });

    it('should use expected Node API for readDirectory', () => {
      const readdirStub = env.stub(fs, 'readdirSync');
      // @ts-ignore wants Dirents but string[] works as well
      readdirStub.withArgs(path).returns(readDirResults);
      expect(tree.readDirectory(path)).to.deep.equal(readDirResults);
      expect(readdirStub.calledOnce).to.be.true;
    });

    it('should use expected Node API for readFile', async () => {
      const readFileStub = env.stub(fs, 'readFileSync');
      // @ts-ignore wants Dirents but string[] works as well
      readFileStub.withArgs(path).resolves(Buffer.from('test'));
      const data = await tree.readFile(path);
      expect(data.toString()).to.deep.equal('test');
      expect(readFileStub.calledOnce).to.be.true;
    });

    it('should use expected Node API for readFileSync', () => {
      const readFileStub = env.stub(fs, 'readFileSync');
      // @ts-ignore wants Dirents but string[] works as well
      readFileStub.withArgs(path).returns(Buffer.from('test'));
      const data = tree.readFileSync(path);
      expect(data.toString()).to.deep.equal('test');
      expect(readFileStub.calledOnce).to.be.true;
    });

    it('should use expected Node API for stream', () => {
      const readable = new Readable();
      const createReadStreamStub = env.stub(fs, 'createReadStream');
      // @ts-ignore wants ReadStream but Readable works for testing
      createReadStreamStub.withArgs(path).returns(readable);
      expect(tree.stream(path)).to.deep.equal(readable);
    });
  });

  describe('ZipTreeContainer', () => {
    let tree: ZipTreeContainer;
    let zipBuffer: Buffer;

    const filesRoot = join('.', 'main', 'default');

    before(async () => {
      const pipeline = promisify(cbPipeline);
      const archive = createArchive('zip', { zlib: { level: 3 } });
      const bufferWritable = new Writable();
      const buffers: Buffer[] = [];
      bufferWritable._write = (chunk: Buffer, encoding: string, cb: () => void): void => {
        buffers.push(chunk);
        cb();
      };
      pipeline(archive, bufferWritable);

      archive.append('', { name: 'main/' });
      archive.append('', { name: 'main/default/' });
      archive.append('test text', { name: 'main/default/test.txt' });
      archive.append('test text 2', { name: 'main/default/test2.txt' });
      archive.append('test text 3', { name: 'main/default/morefiles/test3.txt' });

      await archive.finalize();

      zipBuffer = Buffer.concat(buffers);
      tree = await ZipTreeContainer.create(zipBuffer);
    });

    describe('exists', () => {
      it('should return true for file that exists', () => {
        const path = join(filesRoot, 'test.txt');
        expect(tree.exists(path)).to.be.true;
      });

      it('should return true for directory that exists', () => {
        const path = join(filesRoot, 'morefiles');
        expect(tree.exists(path)).to.be.true;
      });

      it('should return false for file that does not exist', () => {
        const path = join(filesRoot, 'test4.txt');
        expect(tree.exists(path)).to.be.false;
      });

      it('should return false for directory that does not exist', () => {
        const path = join('.', 'dne');
        expect(tree.exists(path)).to.be.false;
      });
    });

    describe('isDirectory', () => {
      it('should return false for isDirectory', () => {
        const path = join(filesRoot, 'test.txt');
        expect(tree.isDirectory(path)).to.be.false;
      });

      it('should return true for isDirectory', () => {
        expect(tree.isDirectory(filesRoot)).to.be.true;
      });

      it('should throw an error if path does not exist', () => {
        const path = 'dne';
        assert.throws(() => tree.isDirectory(path), SfError, messages.getMessage('error_path_not_found', [path]));
      });
    });

    describe('readDirectory', () => {
      it('should return correct directory entries for directory with files and directories', () => {
        expect(tree.readDirectory(filesRoot)).to.deep.equal(['test.txt', 'test2.txt', 'morefiles']);
      });

      it('should return correct directory entries for directory only files', () => {
        const path = join(filesRoot, 'morefiles');
        expect(tree.readDirectory(path)).to.deep.equal(['test3.txt']);
      });

      it('should return correct directory entries for directory with only directories', () => {
        expect(tree.readDirectory('.')).to.deep.equal(['main']);
      });

      it('should throw an error if path is not a directory', () => {
        const path = join(filesRoot, 'test2.txt');
        assert.throws(
          () => tree.readDirectory(path),
          SfError,
          messages.getMessage('error_expected_directory_path', [path])
        );
      });
    });

    describe('readFile', () => {
      it('should read contents of zip entry into buffer', async () => {
        const path = join(filesRoot, 'test.txt');
        const contents = (await tree.readFile(path)).toString();
        expect(contents).to.equal('test text');
      });

      it('should throw an error if path is to directory', () => {
        assert.throws(
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          () => tree.readFile(filesRoot),
          SfError,
          messages.getMessage('error_expected_file_path', [filesRoot])
        );
      });
    });

    describe('readFileSync', () => {
      it('should throw an error because it is not implemented yet', () => {
        assert.throws(() => tree.readFileSync(join(filesRoot, 'test.txt')), Error, 'Method not implemented');
      });
    });

    describe('stream', () => {
      it('should return a readable stream', async () => {
        const path = join(filesRoot, 'test.txt');
        const zipDir = await unzipper.Open.buffer(zipBuffer);
        const expectedStream = zipDir.files.find((f) => normalize(f.path) === path)?.stream();
        assert(expectedStream);
        const actual = tree.stream(path);
        expect(actual instanceof Readable).to.be.true;
        expect((actual as unzipper.Entry).path).to.equal(expectedStream.path);
      });

      it('should throw an error if given path is to a directory', () => {
        assert.throws(
          () => tree.stream(filesRoot),
          SfError,
          messages.getMessage('error_no_directory_stream', [tree.constructor.name])
        );
      });
    });
  });

  describe('VirtualTreeContainer', () => {
    const virtualFS: VirtualDirectory[] = [
      {
        dirPath: '.',
        children: ['test.txt', 'test2.txt', 'files', 'logs'],
      },
      {
        dirPath: join('.', 'files'),
        children: ['test3.txt'],
      },
      {
        dirPath: join('.', 'logs'),
        children: [{ name: 'run.log', data: Buffer.from('successful') }],
      },
    ];
    const tree = new VirtualTreeContainer(virtualFS);

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
        assert.throws(() => tree.isDirectory(path), SfError, messages.getMessage('error_path_not_found', [path]));
      });
    });

    describe('readDirectory', () => {
      it('should return directory entries for readDirectory', () => {
        expect(tree.readDirectory('.')).to.deep.equal(virtualFS[0].children);
      });

      it('should throw an error if path is not a directory', () => {
        assert.throws(
          () => tree.readDirectory('test.txt'),
          SfError,
          messages.getMessage('error_expected_directory_path', ['test.txt'])
        );
      });
    });

    describe('readFile', () => {
      it('should return file data for given path', async () => {
        const data = await tree.readFile(join('.', 'logs', 'run.log'));
        expect(data.toString()).to.equal('successful');
      });

      it('should return empty string buffer if file initialize without data', async () => {
        const data = await tree.readFile(join('.', 'test.txt'));
        expect(data.toString()).to.equal('');
      });

      it('should throw error if path does not exist', async () => {
        const path = 'dne';
        try {
          await tree.readFile(path);
          assert.fail('should have thrown an error');
        } catch (e) {
          assert(e instanceof Error);
          expect(e.message).to.deep.equal(messages.getMessage('error_path_not_found', [path]));
        }
      });
    });

    describe('readFileSync', () => {
      it('should return file data for given path', () => {
        const data = tree.readFileSync(join('.', 'logs', 'run.log'));
        expect(data.toString()).to.equal('successful');
      });

      it('should return empty string buffer if file initialize without data', () => {
        const data = tree.readFileSync(join('.', 'test.txt'));
        expect(data.toString()).to.equal('');
      });

      it('should throw error if path does not exist', () => {
        const path = 'dne';
        try {
          tree.readFileSync(path);
          assert.fail('should have thrown an error');
        } catch (e) {
          assert(e instanceof Error);
          expect(e.message).to.deep.equal(messages.getMessage('error_path_not_found', [path]));
        }
      });
    });

    describe('stream', () => {
      it('should throw a not implemented error', () => {
        assert.throws(() => tree.stream('file'), 'Method not implemented');
      });
    });

    describe('fromFilePaths', () => {
      const classesPath = join('force-app', 'main', 'default', 'classes');
      const tree = VirtualTreeContainer.fromFilePaths([
        join(classesPath, 'TestOrderController.cls'),
        join(classesPath, 'TestOrderController.cls-meta.xml'),
      ]);

      it('tree has expected structure', () => {
        expect(tree.isDirectory('force-app'), 'force-app').to.equal(true);
        expect(tree.isDirectory(join('force-app', 'main')), 'force-app/main').to.equal(true);
        expect(tree.isDirectory(join('force-app', 'main', 'default')), 'force-app/main/default').to.equal(true);
        expect(tree.isDirectory(classesPath), classesPath).to.equal(true);
        expect(tree.readDirectory(classesPath)).to.deep.equal([
          'TestOrderController.cls',
          'TestOrderController.cls-meta.xml',
        ]);
      });

      it('tree resolves to a class', () => {
        const resolver = new MetadataResolver(undefined, tree);
        const resolved = resolver.getComponentsFromPath('force-app');
        expect(resolved.length).to.equal(1);
        expect(resolved[0].type.name).to.equal('ApexClass');
      });
    });
  });
});
