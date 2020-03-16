/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import * as path from 'path';

export function ensureDirectoryExists(filePath: string): void {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return;
  }
  ensureDirectoryExists(dirname);
  fs.mkdirSync(dirname);
}

export function createMetadataFile(
  cacheFilePath: string,
  fileContent: string
): string {
  ensureDirectoryExists(cacheFilePath);

  const writeStream = fs.createWriteStream(cacheFilePath);
  writeStream.write(fileContent);
  writeStream.end();

  return cacheFilePath;
}
