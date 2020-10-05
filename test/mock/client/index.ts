/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { VirtualDirectory } from '../../../src';
import { create as createArchive } from 'archiver';
import { Writable, pipeline } from 'stream';
import { promisify } from 'util';

export const TEST_PACKAGE_BASE_64 =
  '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';

export async function createZipFromVirtualFs(virtualFs: VirtualDirectory[]): Promise<Buffer> {
  const archive = createArchive('zip');
  for (const entry of virtualFs) {
    for (const child of entry.children) {
      if (typeof child === 'string') {
        archive.append('', { name: child });
      } else {
        archive.append(child.data || '', { name: child.name });
      }
    }
  }
  await archive.finalize();
  const bufferWritable = new Writable();
  const buffers: Buffer[] = [];
  bufferWritable._write = (chunk: Buffer, encoding: string, cb: () => void): void => {
    buffers.push(chunk);
    cb();
  };
  await promisify(pipeline)(archive, bufferWritable);
  return Buffer.concat(buffers);
}
