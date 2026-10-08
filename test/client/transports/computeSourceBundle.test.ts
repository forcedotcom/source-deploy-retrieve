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

import { access, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createGzip } from 'node:zlib';
import { buffer as streamToBuffer } from 'node:stream/consumers';
import { expect } from 'chai';
import tarStream from 'tar-stream';
import { packageComputeBundle, unpackComputeBundle } from '../../../src/client/transports/computeSourceBundle';

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
