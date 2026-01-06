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

import * as path from 'node:path';
import fs from 'graceful-fs';
import { SourcePath } from '../common/types';

export const ensureFileExists = async (filePath: string): Promise<void> => {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
};

/**
 * Traverse up a file path and search for the given file name.
 *
 * @param start File or folder path to start searching from
 * @param fileName File name to search for
 */
export function searchUp(start: SourcePath, fileName: string): string | undefined {
  const filePath = path.join(start, fileName);
  if (fs.existsSync(filePath)) {
    return filePath;
  }
  const parent = path.resolve(start, '..');
  if (parent === start || start.split(path.sep).length > 25) {
    return;
  }
  return searchUp(parent, fileName);
}
