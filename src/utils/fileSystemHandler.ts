/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import fs from 'graceful-fs';
import { SourcePath } from '../common/types';

export function ensureFileExists(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.closeSync(fs.openSync(filePath, 'w'));
}

/**
 * Traverse up a file path and search for the given file name.
 *
 * @param start File or folder path to start searching from
 * @param fileName File name to search for
 */
export function searchUp(start: SourcePath, fileName: string): string | undefined {
  console.log('start', start);
  console.log('fileName', fileName);
  const filePath = path.join(start, fileName);
  if (fs.existsSync(filePath)) {
    return filePath;
  }
  const parent = path.resolve(start, '..');
  if (parent === start || start.split(path.sep).length > 50) {
    return;
  }
  return searchUp(parent, fileName);
}
