/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import JSZip from 'jszip';
import { posixify } from '../../../src/utils/path';

// eslint-disable-next-line @typescript-eslint/require-await
export async function createMockZip(entries: string[]): Promise<Buffer> {
  const zip = JSZip();
  // Ensure only posix paths are added to zip files
  entries.map((entry) => zip.file(posixify(entry), ''));
  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
}
