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

import { existsSync } from 'node:fs';
import { access, lstat, mkdir, readdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { dirname, join, parse, relative, resolve, sep } from 'node:path';
import { createGzip, gunzipSync } from 'node:zlib';
import { buffer as streamToBuffer } from 'node:stream/consumers';
import * as tarStream from 'tar-stream';
import { Logger, Messages, SfError } from '@salesforce/core';
import { ForceIgnore } from '../../resolve/forceIgnore';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'computeApp');
const logger = Logger.childFromRoot('computeSourceBundle');

// Compute source bundles are app source, not dependency caches or compiled artifacts.
// Cap the gzip layer and the tar entries retained in memory when unpacking.
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

// Upload shape: deployment-bundle.tar.gz containing api-spec.yaml plus a
// nested source.tar.gz with the app's source files. Downloads return only that
// source.tar.gz (see unpackComputeBundle).
export async function packageComputeBundle(
  appDir: string,
  name: string,
  projectRoot?: string
): Promise<PackagedBundle> {
  const apiSpecPath = join(appDir, 'api-spec.yaml');
  try {
    await access(apiSpecPath);
  } catch {
    throw new SfError(messages.getMessage('missingApiSpec', [name, appDir]), 'MissingApiSpec');
  }
  let hasProcfile = false;
  try {
    // a directory named Procfile, or a differently-cased file on a case-insensitive disk, must not pass
    hasProcfile = (await stat(join(appDir, 'Procfile'))).isFile() && (await readdir(appDir)).includes('Procfile');
  } catch {
    // a missing Procfile is reported below
  }
  if (!hasProcfile) {
    throw new SfError(messages.getMessage('missingProcfile', [name, appDir]), 'MissingProcfile');
  }

  const metaFileName = `${name}.computeApp-meta.xml`;
  const excluded = new Set([metaFileName, '.forceignore']);
  // These files are consumed at build/runtime (and Procfile is checked above), so a broad
  // .forceignore must not remove them from the nested source archive.
  const alwaysIncluded = new Set(['api-spec.yaml', 'project.toml', 'Procfile']);
  // The app's nearest .forceignore and the project-root .forceignore each match paths
  // relative to their own directory, so keep one instance per directory. Neither search
  // goes above the project root, so a stray file in a parent folder or home directory
  // cannot apply.
  const forceIgnores = [nearestForceIgnore(appDir, projectRoot)];
  if (projectRoot && resolve(projectRoot) !== resolve(appDir)) {
    forceIgnores.push(new ForceIgnore(join(projectRoot, '.forceignore')));
  }

  const sourceRelativePaths = await listFilesRecursive(
    appDir,
    (file) =>
      !excluded.has(file) &&
      (alwaysIncluded.has(file) || forceIgnores.every((ignore) => ignore.accepts(join(appDir, file))))
  );
  logger.debug('packaging %s: %d files after exclusions/.forceignore', appDir, sourceRelativePaths.length);

  const apiSpec = await readFile(apiSpecPath);
  if (apiSpec.length > MAX_ENTRY_BYTES) {
    throw messages.createError('bundleApiSpecSizeLimit', [MAX_ENTRY_BYTES]);
  }
  let sourceBytes = 0;
  for (const relativePath of sourceRelativePaths) {
    // eslint-disable-next-line no-await-in-loop
    const { size } = await lstat(join(appDir, relativePath));
    if (size > MAX_ENTRY_BYTES) {
      throw messages.createError('bundleFileSizeLimit', [MAX_ENTRY_BYTES, relativePath]);
    }
    sourceBytes += size;
    if (sourceBytes > MAX_TOTAL_ENTRY_BYTES) {
      throw messages.createError('bundleTotalSizeLimit', [MAX_TOTAL_ENTRY_BYTES]);
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
    throw messages.createError('bundleEntrySizeLimit', [MAX_ENTRY_BYTES]);
  }
  if (sourceEntries.reduce((total, { data }) => total + data.length, 0) > MAX_TOTAL_ENTRY_BYTES) {
    throw messages.createError('bundleTotalSizeLimit', [MAX_TOTAL_ENTRY_BYTES]);
  }
  const sourceTarGz = await tarGzip(sourceEntries);
  if (sourceTarGz.length > MAX_COMPRESSED_BYTES) {
    throw messages.createError('bundleSourceArchiveSizeLimit', [MAX_COMPRESSED_BYTES]);
  }
  if (apiSpec.length + sourceTarGz.length > MAX_TOTAL_ENTRY_BYTES) {
    throw messages.createError('bundleOuterTotalSizeLimit', [MAX_TOTAL_ENTRY_BYTES]);
  }

  const buffer = await tarGzip([
    { name: 'api-spec.yaml', data: apiSpec },
    { name: 'source.tar.gz', data: sourceTarGz },
  ]);
  if (buffer.length > MAX_COMPRESSED_BYTES) {
    throw messages.createError('bundleCompressedSizeLimit', [MAX_COMPRESSED_BYTES]);
  }
  logger.debug('packaged %s into %d bytes (%d files)', appDir, buffer.length, sourceEntries.length);

  return { buffer, fileCount: sourceEntries.length };
}

// Download shape: a flat source.tar.gz of the latest build's source files,
// which already include api-spec.yaml and project.toml.
export async function unpackComputeBundle(buffer: Buffer, appDir: string): Promise<UnpackedBundle> {
  const entries = await untarGzip(buffer);
  const names = Object.keys(entries);
  if (names.length === 0) {
    throw messages.createError('malformedBundleEmpty');
  }

  const resolvedAppDir = resolve(appDir);
  const files = Object.entries(entries).map(([relativePath, data]) => {
    const filePath = resolve(appDir, relativePath);
    // tar-slip guard: reject entries that escape appDir
    if (!filePath.startsWith(resolvedAppDir + sep)) {
      throw messages.createError('malformedBundleUnsafePath', [relativePath]);
    }
    return { filePath, data };
  });
  // Check every output path before writing so a rejected entry leaves the app directory untouched.
  await rejectSymlinks(resolvedAppDir);
  await Promise.all(files.map(({ filePath }) => rejectSymlinks(filePath)));

  await mkdir(appDir, { recursive: true });
  // Settle every write before reporting a failure so no write is still in flight when the caller sees the error.
  const writes = await Promise.allSettled(
    files.map(async ({ filePath, data }) => {
      await mkdir(dirname(filePath), { recursive: true });
      await rejectSymlinks(filePath);
      await writeFile(filePath, data);
    })
  );
  const failed = writes.find((write): write is PromiseRejectedResult => write.status === 'rejected');
  if (failed) throw failed.reason;

  return { fileCount: names.length };
}

async function rejectSymlinks(filePath: string): Promise<void> {
  let current = resolve(filePath);
  const root = parse(current).root;
  // The filesystem root is trusted; inspect every component beneath it, including
  // ancestors of an already-existing app or output file.
  while (current !== root) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const entryStat = await lstat(current);
      if (entryStat.isSymbolicLink()) {
        // macOS exposes /var as a system alias for /private/var. Do not reject
        // ordinary output paths in its temporary directory for that alias.
        // eslint-disable-next-line no-await-in-loop
        if (!(process.platform === 'darwin' && current === '/var' && (await realpath(current)) === '/private/var')) {
          throw messages.createError('malformedBundleSymlink', [current]);
        }
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
    current = dirname(current);
  }
}

function untarGzip(buffer: Buffer): Promise<Record<string, Buffer>> {
  return new Promise((resolveEntries, reject) => {
    if (buffer.length > MAX_COMPRESSED_BYTES) {
      reject(messages.createError('malformedBundleCompressedSizeLimit', [MAX_COMPRESSED_BYTES]));
      return;
    }
    let decompressed: Buffer;
    try {
      decompressed = gunzipSync(buffer, { maxOutputLength: MAX_TAR_BYTES });
    } catch (err) {
      reject(
        (err as NodeJS.ErrnoException).code === 'ERR_BUFFER_TOO_LARGE'
          ? messages.createError('malformedBundleDecompressedSizeLimit', [MAX_TAR_BYTES])
          : messages.createError('malformedBundleInvalidGzip')
      );
      return;
    }

    const entries: Record<string, Buffer> = {};
    const extract = tarStream.extract();
    let entryCount = 0;
    let totalBytes = 0;
    extract.on('entry', (header, stream, next) => {
      // Archives made by system tar list directories; files below them create those paths when written.
      if (header.type === 'directory') {
        stream.on('end', next);
        stream.resume();
        return;
      }
      if (header.type && header.type !== 'file' && header.type !== 'contiguous-file') {
        reject(messages.createError('malformedBundleUnsupportedEntry', [header.type, header.name]));
        extract.destroy();
        return;
      }
      entryCount++;
      if (entryCount > MAX_ENTRIES) {
        reject(messages.createError('malformedBundleEntryCountLimit', [MAX_ENTRIES]));
        extract.destroy();
        return;
      }
      if (
        (header.size && header.size > MAX_ENTRY_BYTES) ||
        (header.size && totalBytes + header.size > MAX_TOTAL_ENTRY_BYTES)
      ) {
        reject(messages.createError('malformedBundleEntrySizeLimit', [MAX_ENTRY_BYTES, MAX_TOTAL_ENTRY_BYTES]));
        extract.destroy();
        return;
      }
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: unknown) => {
        totalBytes += (chunk as Buffer).length;
        if (totalBytes > MAX_TOTAL_ENTRY_BYTES) {
          reject(messages.createError('malformedBundleTotalSizeLimit', [MAX_TOTAL_ENTRY_BYTES]));
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
    extract.on('error', () => reject(messages.createError('malformedBundleInvalidTar')));
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

function nearestForceIgnore(appDir: string, projectRoot?: string): ForceIgnore {
  if (!projectRoot) return ForceIgnore.findAndCreate(appDir);
  const root = resolve(projectRoot);
  let dir = resolve(appDir);
  // Only search upward when the app is inside the project.
  while (dir === root || dir.startsWith(root + sep)) {
    const candidate = join(dir, '.forceignore');
    if (existsSync(candidate)) return new ForceIgnore(candidate);
    if (dir === root) break;
    dir = dirname(dir);
  }
  return new ForceIgnore();
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
            throw messages.createError('bundleEntryCountLimit', [MAX_ENTRIES]);
          }
          files.push(file);
        }
      }
    }
  }
  await walk(base);
  return files;
}
