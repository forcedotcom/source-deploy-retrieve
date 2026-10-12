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

import { access, lstat, mkdir, readdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, join, parse, relative, resolve, sep } from 'node:path';
import { createGzip, gunzipSync } from 'node:zlib';
import { buffer as streamToBuffer } from 'node:stream/consumers';
import tarStream from 'tar-stream';
import { Logger, SfError } from '@salesforce/core';
import { ForceIgnore } from '../../resolve/forceIgnore';

const logger = Logger.childFromRoot('computeSourceBundle');

// Compute source bundles are app source, not dependency caches or compiled artifacts.
// Cap both gzip layers and the tar entries retained in memory when unpacking.
export const MAX_COMPRESSED_BYTES = 40 * 1024 * 1024;
const MAX_TAR_BYTES = 64 * 1024 * 1024;
const MAX_ENTRY_BYTES = 16 * 1024 * 1024;
const MAX_TOTAL_ENTRY_BYTES = 40 * 1024 * 1024;
const MAX_ENTRIES = 1000;

export type PackagedBundle = {
  buffer: Buffer;
  fileCount: number;
};

export type UnpackedBundle = {
  fileCount: number;
};

// Bundle shape: deployment-bundle.tar.gz containing api-spec.yaml plus a
// nested source.tar.gz with the app's source files.
export async function packageComputeBundle(appDir: string, name: string): Promise<PackagedBundle> {
  const apiSpecPath = join(appDir, 'api-spec.yaml');
  try {
    await access(apiSpecPath);
  } catch {
    throw new SfError(`PlatformComputeApp '${name}' is missing required api-spec.yaml in ${appDir}`, 'MissingApiSpec');
  }

  const metaFileName = `${name}.compute-meta.xml`;
  const excluded = new Set(['api-spec.yaml', metaFileName, 'project.toml', '.forceignore']);
  const forceIgnore = ForceIgnore.findAndCreate(appDir);

  const sourceRelativePaths = await listFilesRecursive(
    appDir,
    (file) => !excluded.has(file) && forceIgnore.accepts(join(appDir, file))
  );
  logger.debug('packaging %s: %d files after exclusions/.forceignore', appDir, sourceRelativePaths.length);

  const apiSpec = await readFile(apiSpecPath);
  if (apiSpec.length > MAX_ENTRY_BYTES) {
    throw new Error(`Compute source bundle: api-spec.yaml entry size limit (${MAX_ENTRY_BYTES} bytes) exceeded`);
  }
  let sourceBytes = 0;
  for (const relativePath of sourceRelativePaths) {
    // eslint-disable-next-line no-await-in-loop
    const { size } = await lstat(join(appDir, relativePath));
    if (size > MAX_ENTRY_BYTES) {
      throw new Error(
        `Compute source bundle: entry size limit (${MAX_ENTRY_BYTES} bytes) exceeded for ${relativePath}`
      );
    }
    sourceBytes += size;
    if (sourceBytes > MAX_TOTAL_ENTRY_BYTES) {
      throw new Error(`Compute source bundle: total size limit (${MAX_TOTAL_ENTRY_BYTES} bytes) exceeded`);
    }
  }

  const sourceEntries = await Promise.all(
    sourceRelativePaths.map(async (relativePath) => ({
      name: relativePath,
      data: await readFile(join(appDir, relativePath)),
    }))
  );
  // The source may change between stat and read; check actual bytes before assembling.
  if (sourceEntries.some(({ data }) => data.length > MAX_ENTRY_BYTES)) {
    throw new Error(`Compute source bundle: entry size limit (${MAX_ENTRY_BYTES} bytes) exceeded`);
  }
  if (sourceEntries.reduce((total, { data }) => total + data.length, 0) > MAX_TOTAL_ENTRY_BYTES) {
    throw new Error(`Compute source bundle: total size limit (${MAX_TOTAL_ENTRY_BYTES} bytes) exceeded`);
  }
  const sourceTarGz = await tarGzip(sourceEntries);
  if (sourceTarGz.length > MAX_COMPRESSED_BYTES) {
    throw new Error(`Compute source bundle: source.tar.gz entry size limit (${MAX_COMPRESSED_BYTES} bytes) exceeded`);
  }
  if (apiSpec.length + sourceTarGz.length > MAX_TOTAL_ENTRY_BYTES) {
    throw new Error(`Compute source bundle: outer total size limit (${MAX_TOTAL_ENTRY_BYTES} bytes) exceeded`);
  }

  const buffer = await tarGzip([
    { name: 'api-spec.yaml', data: apiSpec },
    { name: 'source.tar.gz', data: sourceTarGz },
  ]);
  if (buffer.length > MAX_COMPRESSED_BYTES) {
    throw new Error(`Compute source bundle: compressed size limit (${MAX_COMPRESSED_BYTES} bytes) exceeded`);
  }
  logger.debug('packaged %s into %d bytes (%d files)', appDir, buffer.length, sourceEntries.length + 1);

  return { buffer, fileCount: sourceEntries.length + 1 };
}

export async function unpackComputeBundle(buffer: Buffer, appDir: string): Promise<UnpackedBundle> {
  const outer = await untarGzip(buffer, true);
  const apiSpec = outer['api-spec.yaml'];
  const sourceTarGz = outer['source.tar.gz'];
  if (!apiSpec || !sourceTarGz) {
    const missing = [!apiSpec && 'api-spec.yaml', !sourceTarGz && 'source.tar.gz'].filter(Boolean).join(', ');
    throw new Error(`Malformed compute source bundle: missing ${missing}`);
  }

  const resolvedAppDir = resolve(appDir);
  await rejectSymlinks(resolvedAppDir);
  await mkdir(appDir, { recursive: true });
  await rejectSymlinks(join(resolvedAppDir, 'api-spec.yaml'));
  await writeFile(join(appDir, 'api-spec.yaml'), apiSpec);

  const sourceEntries = await untarGzip(sourceTarGz, false);
  await Promise.all(
    Object.entries(sourceEntries).map(async ([relativePath, data]) => {
      const filePath = resolve(appDir, relativePath);
      // tar-slip guard: reject entries that escape appDir
      if (filePath !== resolvedAppDir && !filePath.startsWith(resolvedAppDir + sep)) {
        throw new Error(`Malformed compute source bundle: unsafe entry path "${relativePath}"`);
      }
      await rejectSymlinks(filePath);
      await mkdir(dirname(filePath), { recursive: true });
      await rejectSymlinks(filePath);
      await writeFile(filePath, data);
    })
  );

  return { fileCount: Object.keys(sourceEntries).length + 1 };
}

async function rejectSymlinks(filePath: string): Promise<void> {
  let current = resolve(filePath);
  const root = parse(current).root;
  // The filesystem root is trusted; inspect every component beneath it, including
  // ancestors of an already-existing app or output file.
  while (current !== root) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const stat = await lstat(current);
      if (stat.isSymbolicLink()) {
        // macOS exposes /var as a system alias for /private/var. Do not reject
        // ordinary output paths in its temporary directory for that alias.
        // eslint-disable-next-line no-await-in-loop
        if (!(process.platform === 'darwin' && current === '/var' && (await realpath(current)) === '/private/var')) {
          throw new Error(`Malformed compute source bundle: symlink in output path "${current}"`);
        }
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
    current = dirname(current);
  }
}

function untarGzip(buffer: Buffer, outer: boolean): Promise<Record<string, Buffer>> {
  return new Promise((resolveEntries, reject) => {
    if (buffer.length > MAX_COMPRESSED_BYTES) {
      reject(
        new Error(`Malformed compute source bundle: compressed size limit (${MAX_COMPRESSED_BYTES} bytes) exceeded`)
      );
      return;
    }
    let decompressed: Buffer;
    try {
      decompressed = gunzipSync(buffer, { maxOutputLength: MAX_TAR_BYTES });
    } catch (err) {
      reject(
        new Error(
          (err as NodeJS.ErrnoException).code === 'ERR_BUFFER_TOO_LARGE'
            ? `Malformed compute source bundle: decompressed size limit (${MAX_TAR_BYTES} bytes) exceeded`
            : 'Malformed compute source bundle: not a valid gzip archive'
        )
      );
      return;
    }

    const entries: Record<string, Buffer> = {};
    const extract = tarStream.extract();
    let entryCount = 0;
    let totalBytes = 0;
    extract.on('entry', (header, stream, next) => {
      entryCount++;
      if (entryCount > MAX_ENTRIES) {
        reject(new Error(`Malformed compute source bundle: entry count limit (${MAX_ENTRIES}) exceeded`));
        extract.destroy();
        return;
      }
      const entryLimit = outer && header.name === 'source.tar.gz' ? MAX_COMPRESSED_BYTES : MAX_ENTRY_BYTES;
      if (header.size > entryLimit || totalBytes + header.size > MAX_TOTAL_ENTRY_BYTES) {
        reject(
          new Error(
            `Malformed compute source bundle: entry size limit (${entryLimit} bytes) or total size limit (${MAX_TOTAL_ENTRY_BYTES} bytes) exceeded`
          )
        );
        extract.destroy();
        return;
      }
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: unknown) => {
        totalBytes += (chunk as Buffer).length;
        if (totalBytes > MAX_TOTAL_ENTRY_BYTES) {
          reject(
            new Error(`Malformed compute source bundle: total size limit (${MAX_TOTAL_ENTRY_BYTES} bytes) exceeded`)
          );
          extract.destroy();
          return;
        }
        chunks.push(chunk as Buffer);
      });
      stream.on('end', () => {
        entries[header.name] = Buffer.concat(chunks);
        next();
      });
      stream.on('error', reject);
      stream.resume();
    });
    extract.on('finish', () => resolveEntries(entries));
    extract.on('error', () => reject(new Error('Malformed compute source bundle: not a valid tar archive')));
    extract.end(decompressed);
  });
}

async function tarGzip(entries: ReadonlyArray<{ name: string; data: Buffer }>): Promise<Buffer> {
  const pack = tarStream.pack();

  // Pipe BEFORE writing entries to avoid deadlock: pack is a Readable with
  // a 16KB highWaterMark — without a consumer attached, backpressure stalls
  // the entry callbacks once buffered bytes exceed the threshold.
  const gzippedBufferPromise = streamToBuffer(pack.pipe(createGzip()));

  await entries.reduce(
    (previous, { name, data }) =>
      previous.then(
        async () =>
          new Promise<void>((resolveEntry, reject) => {
            pack.entry({ name, size: data.length }, data, (err) => (err ? reject(err) : resolveEntry()));
          })
      ),
    Promise.resolve()
  );
  pack.finalize();
  return gzippedBufferPromise;
}

async function listFilesRecursive(base: string, accepts: (file: string) => boolean): Promise<string[]> {
  const files: string[] = [];
  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        // eslint-disable-next-line no-await-in-loop
        await walk(full);
      } else if (entry.isFile()) {
        const file = relative(base, full).split(sep).join('/');
        if (accepts(file)) {
          if (files.length === MAX_ENTRIES) {
            throw new Error(`Compute source bundle: entry count limit (${MAX_ENTRIES}) exceeded`);
          }
          files.push(file);
        }
      }
    }
  }
  await walk(base);
  return files;
}
