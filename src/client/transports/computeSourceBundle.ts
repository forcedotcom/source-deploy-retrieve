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

import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { createGzip, gunzipSync } from 'node:zlib';
import { buffer as streamToBuffer } from 'node:stream/consumers';
import tarStream from 'tar-stream';
import { Logger, SfError } from '@salesforce/core';
import { ForceIgnore } from '../../resolve/forceIgnore';

const logger = Logger.childFromRoot('computeSourceBundle');

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

  const allFiles = await listFilesRecursive(appDir);
  const sourceRelativePaths = allFiles.filter((f) => !excluded.has(f) && forceIgnore.accepts(join(appDir, f)));
  logger.debug(
    'packaging %s: %d of %d files after exclusions/.forceignore',
    appDir,
    sourceRelativePaths.length,
    allFiles.length
  );

  const sourceEntries = await Promise.all(
    sourceRelativePaths.map(async (relativePath) => ({
      name: relativePath,
      data: await readFile(join(appDir, relativePath)),
    }))
  );
  const sourceTarGz = await tarGzip(sourceEntries);
  const apiSpec = await readFile(apiSpecPath);

  const buffer = await tarGzip([
    { name: 'api-spec.yaml', data: apiSpec },
    { name: 'source.tar.gz', data: sourceTarGz },
  ]);
  logger.debug('packaged %s into %d bytes (%d files)', appDir, buffer.length, sourceEntries.length + 1);

  return { buffer, fileCount: sourceEntries.length + 1 };
}

export async function unpackComputeBundle(buffer: Buffer, appDir: string): Promise<UnpackedBundle> {
  const outer = await untarGzip(buffer);
  const apiSpec = outer['api-spec.yaml'];
  const sourceTarGz = outer['source.tar.gz'];
  if (!apiSpec || !sourceTarGz) {
    const missing = [!apiSpec && 'api-spec.yaml', !sourceTarGz && 'source.tar.gz'].filter(Boolean).join(', ');
    throw new Error(`Malformed compute source bundle: missing ${missing}`);
  }

  await writeFile(join(appDir, 'api-spec.yaml'), apiSpec);

  const sourceEntries = await untarGzip(sourceTarGz);
  const resolvedAppDir = resolve(appDir);
  await Promise.all(
    Object.entries(sourceEntries).map(async ([relativePath, data]) => {
      const filePath = resolve(appDir, relativePath);
      // tar-slip guard: reject entries that escape appDir
      if (filePath !== resolvedAppDir && !filePath.startsWith(resolvedAppDir + sep)) {
        throw new Error(`Malformed compute source bundle: unsafe entry path "${relativePath}"`);
      }
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, data);
    })
  );

  return { fileCount: Object.keys(sourceEntries).length + 1 };
}

function untarGzip(buffer: Buffer): Promise<Record<string, Buffer>> {
  return new Promise((resolveEntries, reject) => {
    let decompressed: Buffer;
    try {
      decompressed = gunzipSync(buffer);
    } catch {
      reject(new Error('Malformed compute source bundle: not a valid gzip archive'));
      return;
    }

    const entries: Record<string, Buffer> = {};
    const extract = tarStream.extract();
    extract.on('entry', (header, stream, next) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: unknown) => chunks.push(chunk as Buffer));
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

async function listFilesRecursive(dir: string, base = dir): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry): Promise<string[]> => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        return listFilesRecursive(full, base);
      }
      if (entry.isFile()) {
        return [relative(base, full).split(sep).join('/')];
      }
      return [];
    })
  );
  return nested.flat();
}
