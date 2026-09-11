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
 * Traverse up a file path and search for the given file name.  Always returns an absolute path.
 *
 * @param start File or folder path to start searching from
 * @param fileName File name to search for
 */
export function searchUp(start: SourcePath, fileName: string): string | undefined {
  const absoluteStart = path.isAbsolute(start) ? start : path.join(process.cwd(), start);
  const filePath = path.join(absoluteStart, fileName);
  if (fs.existsSync(filePath)) {
    return filePath;
  }

  const normalizedAbsoluteStart = path.normalize(absoluteStart);
  const parent = path.dirname(normalizedAbsoluteStart);

  // If we're at root, stop (don't try to go up with ..)
  if (parent === normalizedAbsoluteStart || normalizedAbsoluteStart === path.parse(normalizedAbsoluteStart).root) {
    return;
  }

  return searchUp(parent, fileName);
}

/**
 * Walk every path segment between the root (exclusive) and the destination
 * (inclusive) and return the first one that is a symbolic link, or undefined if none is.
 *
 * Both `createWriteStream` and recursive `mkdir` follow symlinks, so a link planted anywhere
 * along the destination path can redirect writes outside the root. The root is assumed trusted
 * and is not checked.
 */
export const findSymlinkOnPath = async (root: string, destination: string): Promise<string | undefined> => {
  const rel = path.relative(root, destination);
  const segments = rel.split(path.sep).filter((s) => s.length > 0);
  const paths = segments.map((_, i) => path.join(root, ...segments.slice(0, i + 1)));
  const results = await Promise.all(
    paths.map(async (p) => {
      try {
        return (await fs.promises.lstat(p)).isSymbolicLink();
      } catch {
        return false;
      }
    })
  );
  return paths.find((_, i) => results[i]);
};
