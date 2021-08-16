/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Connection, AuthInfo } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/lib/testSetup';
import { create as createArchive } from 'archiver';
import { Writable, pipeline } from 'stream';
import { promisify } from 'util';

export async function createMockZip(entries: string[]): Promise<Buffer> {
  const archive = createArchive('zip');
  for (const entry of entries) {
    archive.append('', { name: entry });
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

export async function mockConnection($$: TestContext): Promise<Connection> {
  const testData = new MockTestOrgData();
  $$.setConfigStubContents('AuthInfoConfig', {
    contents: await testData.getConfig(),
  });
  return Connection.create({
    authInfo: await AuthInfo.create({
      username: testData.username,
    }),
  });
}
