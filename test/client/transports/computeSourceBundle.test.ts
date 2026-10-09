/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { access, chmod, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createGzip, gzipSync } from 'node:zlib';
import { buffer as streamToBuffer } from 'node:stream/consumers';
import { promises as fsPromises } from 'node:fs';
import { expect } from 'chai';
import sinon from 'sinon';
import tarStream from 'tar-stream';
import { packageComputeBundle, unpackComputeBundle } from '../../../src/client/transports/computeSourceBundle';

async function archive(entries: Array<{ name: string; data: Buffer }>): Promise<Buffer> {
  const pack = tarStream.pack();
  const output = streamToBuffer(pack.pipe(createGzip()));
  for (const entry of entries) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise<void>((resolve, reject) =>
      pack.entry({ name: entry.name }, entry.data, (err) => (err ? reject(err) : resolve()))
    );
  }
  pack.finalize();
  return output;
}

describe('computeSourceBundle', () => {
  let tempDir: string;
  let appDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `sdr-bundle-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    appDir = join(tempDir, 'force-app', 'platformComputeApps', 'MyApp');
    await mkdir(appDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('packageComputeBundle', () => {
    it('stops walking other directories once the source entry cap is exceeded', async () => {
      await writeFile(join(appDir, 'api-spec.yaml'), 'spec');
      const first = join(appDir, 'a');
      const later = join(appDir, 'z');
      await mkdir(first);
      await mkdir(later);
      await Promise.all(Array.from({ length: 1001 }, (_, i) => writeFile(join(first, `${i}.py`), 'x')));
      const readdir = sinon.spy(fsPromises, 'readdir');
      try {
        let error: Error | undefined;
        try {
          await packageComputeBundle(appDir, 'MyApp');
        } catch (err) {
          error = err as Error;
        }
        expect(error?.message).to.include('entry count limit');
        expect(readdir.getCalls().some(({ args }) => args[0] === later)).to.be.false;
      } finally {
        readdir.restore();
      }
    });

    it('rejects source entry count beyond the unpack limit', async () => {
      await writeFile(join(appDir, 'api-spec.yaml'), 'spec');
      await Promise.all(Array.from({ length: 1001 }, (_, i) => writeFile(join(appDir, `${i}.py`), 'x')));
      try {
        await packageComputeBundle(appDir, 'MyApp');
        expect.fail('should reject count');
      } catch (err) {
        expect((err as Error).message).to.include('entry count limit');
      }
    });

    it('accepts a source entry exactly at the per-entry limit', async () => {
      await writeFile(join(appDir, 'api-spec.yaml'), 'spec');
      await writeFile(join(appDir, 'large.py'), Buffer.alloc(16 * 1024 * 1024));
      const bundle = await packageComputeBundle(appDir, 'MyApp');
      await unpackComputeBundle(bundle.buffer, join(tempDir, 'boundary-output'));
      expect(bundle.fileCount).to.equal(2);
    });

    it('rejects a source entry above the per-entry limit', async () => {
      await writeFile(join(appDir, 'api-spec.yaml'), 'spec');
      await writeFile(join(appDir, 'large.py'), Buffer.alloc(16 * 1024 * 1024 + 1));
      try {
        await packageComputeBundle(appDir, 'MyApp');
        expect.fail('should reject size');
      } catch (err) {
        expect((err as Error).message).to.include('entry size limit');
      }
    });

    it('rejects aggregate source entry bytes above the unpack limit', async () => {
      await writeFile(join(appDir, 'api-spec.yaml'), 'spec');
      await Promise.all([0, 1, 2].map((i) => writeFile(join(appDir, `${i}.py`), Buffer.alloc(14 * 1024 * 1024))));
      try {
        await packageComputeBundle(appDir, 'MyApp');
        expect.fail('should reject size');
      } catch (err) {
        expect((err as Error).message).to.include('total size limit');
      }
    });

    it('rejects an outer api-spec entry above the unpack per-entry limit', async () => {
      await writeFile(join(appDir, 'api-spec.yaml'), Buffer.alloc(16 * 1024 * 1024 + 1));
      try {
        await packageComputeBundle(appDir, 'MyApp');
        expect.fail('should reject outer entry size');
      } catch (err) {
        expect((err as Error).message).to.include('api-spec.yaml entry size limit');
      }
    });

    it('does not traverse dot-directories even when nested', async () => {
      await writeFile(join(appDir, 'api-spec.yaml'), 'spec');
      await mkdir(join(appDir, 'lib', '.hidden'), { recursive: true });
      await writeFile(join(appDir, 'lib', '.hidden', 'secret'), 'secret');
      await chmod(join(appDir, 'lib', '.hidden'), 0);
      try {
        const bundle = await packageComputeBundle(appDir, 'MyApp');
        expect(bundle.fileCount).to.equal(1);
      } finally {
        await chmod(join(appDir, 'lib', '.hidden'), 0o700);
      }
    });

    it('excludes dotfiles, VCS trees, and secrets without .forceignore', async () => {
      await writeFile(join(appDir, 'api-spec.yaml'), 'openapi: 3.0.0');
      await writeFile(join(appDir, 'main.py'), 'safe');
      await writeFile(join(appDir, '.env'), 'SECRET=1');
      await mkdir(join(appDir, '.git', 'objects'), { recursive: true });
      await writeFile(join(appDir, '.git', 'objects', 'secret'), 'secret');
      await mkdir(join(appDir, 'lib', '.hidden'), { recursive: true });
      await writeFile(join(appDir, 'lib', '.hidden', 'secret'), 'secret');

      const bundle = await packageComputeBundle(appDir, 'MyApp');
      expect(bundle.fileCount).to.equal(2);
      const output = join(tempDir, 'safe-output');
      await unpackComputeBundle(bundle.buffer, output);
      expect(await readFile(join(output, 'main.py'), 'utf8')).to.equal('safe');
      for (const path of ['.env', '.git/objects/secret', 'lib/.hidden/secret']) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await access(join(output, path));
          expect.fail(`${path} should not be bundled`);
        } catch (err) {
          expect((err as NodeJS.ErrnoException).code).to.equal('ENOENT');
        }
      }
    });
    it('should package app directory into a bundle', async () => {
      await writeFile(join(appDir, 'api-spec.yaml'), 'openapi: 3.0.0\ninfo:\n  title: test');
      await writeFile(join(appDir, 'MyApp.compute-meta.xml'), '<PlatformComputeApp/>');
      await writeFile(join(appDir, 'main.py'), 'print("hello")');
      await mkdir(join(appDir, 'lib'), { recursive: true });
      await writeFile(join(appDir, 'lib', 'utils.py'), 'def helper(): pass');

      const result = await packageComputeBundle(appDir, 'MyApp');

      expect(result.buffer).to.be.instanceOf(Buffer);
      expect(result.buffer.length).to.be.greaterThan(0);
      // api-spec.yaml counts as +1 in the outer bundle, source files are main.py + lib/utils.py = 2
      // fileCount = source entries + 1 (api-spec)
      expect(result.fileCount).to.equal(3);
    });

    it('should exclude meta XML, api-spec, project.toml, and .forceignore from source tar', async () => {
      await writeFile(join(appDir, 'api-spec.yaml'), 'openapi: 3.0.0');
      await writeFile(join(appDir, 'MyApp.compute-meta.xml'), '<PlatformComputeApp/>');
      await writeFile(join(appDir, 'project.toml'), '[project]\nname = "test"');
      await writeFile(join(appDir, '.forceignore'), '*.log');
      await writeFile(join(appDir, 'main.py'), 'print("hello")');

      const result = await packageComputeBundle(appDir, 'MyApp');

      // Only main.py is in source + api-spec = 2
      expect(result.fileCount).to.equal(2);
    });

    it('should respect .forceignore patterns', async () => {
      await writeFile(join(appDir, 'api-spec.yaml'), 'openapi: 3.0.0');
      await writeFile(join(appDir, 'MyApp.compute-meta.xml'), '<PlatformComputeApp/>');
      await writeFile(join(appDir, '.forceignore'), '*.log\n__pycache__/');
      await writeFile(join(appDir, 'main.py'), 'print("hello")');
      await writeFile(join(appDir, 'debug.log'), 'log entry');
      await mkdir(join(appDir, '__pycache__'), { recursive: true });
      await writeFile(join(appDir, '__pycache__', 'main.cpython.pyc'), 'bytecode');

      const result = await packageComputeBundle(appDir, 'MyApp');

      // Only main.py is in source + api-spec = 2
      expect(result.fileCount).to.equal(2);
    });
  });

  describe('unpackComputeBundle', () => {
    it('rejects an oversized compressed download buffer', async () => {
      try {
        await unpackComputeBundle(Buffer.alloc(40 * 1024 * 1024 + 1), join(tempDir, 'out'));
        expect.fail('should reject size');
      } catch (err) {
        expect((err as Error).message).to.include('size limit');
      }
    });

    it('rejects oversized decompressed outer gzip as a size limit', async () => {
      try {
        await unpackComputeBundle(gzipSync(Buffer.alloc(64 * 1024 * 1024 + 1)), join(tempDir, 'out'));
        expect.fail('should reject size');
      } catch (err) {
        expect((err as Error).message).to.include('size limit');
      }
    });

    it('rejects oversized decompressed inner gzip as a size limit', async () => {
      const bundle = await archive([
        { name: 'api-spec.yaml', data: Buffer.from('spec') },
        { name: 'source.tar.gz', data: gzipSync(Buffer.alloc(64 * 1024 * 1024 + 1)) },
      ]);
      try {
        await unpackComputeBundle(bundle, join(tempDir, 'out'));
        expect.fail('should reject size');
      } catch (err) {
        expect((err as Error).message).to.include('size limit');
      }
    });

    it('rejects an oversized tar entry', async () => {
      const inner = await archive([{ name: 'huge.py', data: Buffer.alloc(16 * 1024 * 1024 + 1) }]);
      const outer = await archive([
        { name: 'api-spec.yaml', data: Buffer.from('spec') },
        { name: 'source.tar.gz', data: inner },
      ]);
      try {
        await unpackComputeBundle(outer, join(tempDir, 'out'));
        expect.fail('should reject size');
      } catch (err) {
        expect((err as Error).message).to.include('size limit');
      }
    });

    it('applies the source entry size limit even to a file named source.tar.gz', async () => {
      const inner = await archive([{ name: 'source.tar.gz', data: Buffer.alloc(16 * 1024 * 1024 + 1) }]);
      const outer = await archive([
        { name: 'api-spec.yaml', data: Buffer.from('spec') },
        { name: 'source.tar.gz', data: inner },
      ]);
      try {
        await unpackComputeBundle(outer, join(tempDir, 'out'));
        expect.fail('should reject size');
      } catch (err) {
        expect((err as Error).message).to.include('size limit');
      }
    });

    it('rejects aggregate tar entry bytes above the limit', async () => {
      const inner = await archive([0, 1, 2].map((i) => ({ name: `${i}.py`, data: Buffer.alloc(16 * 1024 * 1024) })));
      const outer = await archive([
        { name: 'api-spec.yaml', data: Buffer.from('spec') },
        { name: 'source.tar.gz', data: inner },
      ]);
      try {
        await unpackComputeBundle(outer, join(tempDir, 'out'));
        expect.fail('should reject size');
      } catch (err) {
        expect((err as Error).message).to.include('size limit');
      }
    });

    it('rejects an excessive inner tar entry count', async () => {
      const inner = await archive(
        Array.from({ length: 1001 }, (_, i) => ({ name: `${i}.py`, data: Buffer.from('x') }))
      );
      const outer = await archive([
        { name: 'api-spec.yaml', data: Buffer.from('spec') },
        { name: 'source.tar.gz', data: inner },
      ]);
      try {
        await unpackComputeBundle(outer, join(tempDir, 'out'));
        expect.fail('should reject count');
      } catch (err) {
        expect((err as Error).message).to.include('entry count limit');
      }
    });
    it('rejects an existing app and output file below a symlinked ancestor without overwriting outside', async () => {
      await writeFile(join(appDir, 'api-spec.yaml'), 'openapi: 3.0.0');
      await writeFile(join(appDir, 'main.py'), 'new');
      const bundle = await packageComputeBundle(appDir, 'MyApp');
      const outside = join(tempDir, 'outside');
      const outsideApp = join(outside, 'platformComputeApps', 'MyApp');
      await mkdir(outsideApp, { recursive: true });
      await writeFile(join(outsideApp, 'api-spec.yaml'), 'original spec');
      await writeFile(join(outsideApp, 'main.py'), 'original source');
      const outputLink = join(tempDir, 'output-link');
      await symlink(outside, outputLink);

      let error: Error | undefined;
      try {
        await unpackComputeBundle(bundle.buffer, join(outputLink, 'platformComputeApps', 'MyApp'));
      } catch (err) {
        error = err as Error;
      }
      expect(error?.message).to.include('symlink');
      expect(await readFile(join(outsideApp, 'api-spec.yaml'), 'utf8')).to.equal('original spec');
      expect(await readFile(join(outsideApp, 'main.py'), 'utf8')).to.equal('original source');
    });

    it('rejects a symlinked app directory without writing outside', async () => {
      await writeFile(join(appDir, 'api-spec.yaml'), 'openapi: 3.0.0');
      await writeFile(join(appDir, 'main.py'), 'safe');
      const bundle = await packageComputeBundle(appDir, 'MyApp');
      const outside = join(tempDir, 'outside');
      await mkdir(outside);
      const output = join(tempDir, 'output-link');
      await symlink(outside, output);

      try {
        await unpackComputeBundle(bundle.buffer, output);
        expect.fail('should reject symlinked output');
      } catch (err) {
        expect((err as Error).message).to.include('symlink');
      }
      try {
        await access(join(outside, 'api-spec.yaml'));
        expect.fail('should not write outside');
      } catch (err) {
        expect((err as Error).message).to.not.include('should not write outside');
      }
    });

    it('rejects an app directory below a symlinked ancestor without writing outside', async () => {
      await writeFile(join(appDir, 'api-spec.yaml'), 'openapi: 3.0.0');
      await writeFile(join(appDir, 'main.py'), 'safe');
      const bundle = await packageComputeBundle(appDir, 'MyApp');
      const outside = join(tempDir, 'outside');
      await mkdir(outside);
      const outputLink = join(tempDir, 'output-link');
      await symlink(outside, outputLink);
      const output = join(outputLink, 'platformComputeApps', 'MyApp');

      try {
        await unpackComputeBundle(bundle.buffer, output);
        expect.fail('should reject symlinked output ancestor');
      } catch (err) {
        expect((err as Error).message).to.include('symlink');
      }
      try {
        await access(join(outside, 'platformComputeApps', 'MyApp', 'api-spec.yaml'));
        expect.fail('should not write outside');
      } catch (err) {
        expect((err as Error).message).to.not.include('should not write outside');
      }
    });

    it('rejects an existing symlinked nested source directory without writing outside', async () => {
      await writeFile(join(appDir, 'api-spec.yaml'), 'openapi: 3.0.0');
      await mkdir(join(appDir, 'lib'));
      await writeFile(join(appDir, 'lib', 'utils.py'), 'safe');
      const bundle = await packageComputeBundle(appDir, 'MyApp');
      const output = join(tempDir, 'output');
      const outside = join(tempDir, 'outside');
      await mkdir(output);
      await mkdir(outside);
      await symlink(outside, join(output, 'lib'));

      try {
        await unpackComputeBundle(bundle.buffer, output);
        expect.fail('should reject symlinked child');
      } catch (err) {
        expect((err as Error).message).to.include('symlink');
      }
      try {
        await access(join(outside, 'utils.py'));
        expect.fail('should not write outside');
      } catch (err) {
        expect((err as Error).message).to.not.include('should not write outside');
      }
    });

    it('rejects a symlinked api-spec output without writing outside', async () => {
      await writeFile(join(appDir, 'api-spec.yaml'), 'openapi: 3.0.0');
      await writeFile(join(appDir, 'main.py'), 'safe');
      const bundle = await packageComputeBundle(appDir, 'MyApp');
      const output = join(tempDir, 'output');
      const outside = join(tempDir, 'outside-spec.yaml');
      await mkdir(output);
      await writeFile(outside, 'original');
      await symlink(outside, join(output, 'api-spec.yaml'));

      try {
        await unpackComputeBundle(bundle.buffer, output);
        expect.fail('should reject symlinked api-spec');
      } catch (err) {
        expect((err as Error).message).to.include('symlink');
      }
      expect(await readFile(outside, 'utf8')).to.equal('original');
    });

    it('should round-trip pack and unpack', async () => {
      await writeFile(join(appDir, 'api-spec.yaml'), 'openapi: 3.0.0\ninfo:\n  title: test');
      await writeFile(join(appDir, 'MyApp.compute-meta.xml'), '<PlatformComputeApp/>');
      await writeFile(join(appDir, 'main.py'), 'print("hello")');
      await mkdir(join(appDir, 'lib'), { recursive: true });
      await writeFile(join(appDir, 'lib', 'utils.py'), 'def helper(): pass');

      const packed = await packageComputeBundle(appDir, 'MyApp');

      const outputDir = join(tempDir, 'output');
      await mkdir(outputDir, { recursive: true });

      const unpacked = await unpackComputeBundle(packed.buffer, outputDir);

      expect(unpacked.fileCount).to.be.greaterThan(0);

      const apiSpec = await readFile(join(outputDir, 'api-spec.yaml'), 'utf8');
      expect(apiSpec).to.include('openapi: 3.0.0');

      const mainPy = await readFile(join(outputDir, 'main.py'), 'utf8');
      expect(mainPy).to.equal('print("hello")');

      const utilsPy = await readFile(join(outputDir, 'lib', 'utils.py'), 'utf8');
      expect(utilsPy).to.equal('def helper(): pass');
    });

    it('should throw on malformed bundle (not gzip)', async () => {
      try {
        await unpackComputeBundle(Buffer.from('not a gzip'), join(tempDir, 'out'));
        expect.fail('should have thrown');
      } catch (err) {
        expect((err as Error).message).to.include('not a valid gzip archive');
      }
    });

    it('should throw on bundle missing required entries', async () => {
      const pack = tarStream.pack();
      const bufPromise = streamToBuffer(pack.pipe(createGzip()));
      pack.entry({ name: 'random.txt' }, 'data', () => {
        pack.finalize();
      });
      const buf = await bufPromise;

      try {
        await unpackComputeBundle(buf, join(tempDir, 'out'));
        expect.fail('should have thrown');
      } catch (err) {
        expect((err as Error).message).to.include('missing api-spec.yaml, source.tar.gz');
      }
    });

    it('should reject tar-slip entries', async () => {
      const innerPack = tarStream.pack();
      const innerBufPromise = streamToBuffer(innerPack.pipe(createGzip()));
      innerPack.entry({ name: '../../../etc/passwd' }, 'malicious', () => {
        innerPack.finalize();
      });
      const innerBuf = await innerBufPromise;

      // Outer bundle
      const outerPack = tarStream.pack();
      const outerBufPromise = streamToBuffer(outerPack.pipe(createGzip()));
      await new Promise<void>((resolve, reject) => {
        outerPack.entry({ name: 'api-spec.yaml' }, 'openapi: 3.0.0', (err) => {
          if (err) reject(err);
          outerPack.entry({ name: 'source.tar.gz' }, innerBuf, (err2) => {
            if (err2) reject(err2);
            outerPack.finalize();
            resolve();
          });
        });
      });
      const outerBuf = await outerBufPromise;

      const outputDir = join(tempDir, 'tar-slip-test');
      await mkdir(outputDir, { recursive: true });

      try {
        await unpackComputeBundle(outerBuf, outputDir);
        expect.fail('should have thrown');
      } catch (err) {
        expect((err as Error).message).to.include('unsafe entry path');
      }
    });
  });
});
