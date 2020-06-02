/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import * as path from 'path';
import { SourcePath } from '../types';

export function ensureDirectoryExists(filePath: string): void {
  if (fs.existsSync(filePath)) {
    return;
  }
  ensureDirectoryExists(path.dirname(filePath));
  fs.mkdirSync(filePath);
}

export function ensureFileExists(filePath: string): void {
  ensureDirectoryExists(path.dirname(filePath));
  fs.closeSync(fs.openSync(filePath, 'w'));
}

/**
 * Method to save multiple files on disk.
 *
 * @param fileMap key = filePath, value = file contents
 */
export function createFiles(fileMap: Map<string, string>): void {
  for (const filePath of fileMap.keys()) {
    ensureDirectoryExists(filePath);

    const writeStream = fs.createWriteStream(filePath);
    writeStream.write(fileMap.get(filePath));
    writeStream.end();
  }
}

export function isDirectory(fsPath: SourcePath): boolean {
  return fs.lstatSync(fsPath).isDirectory();
}

/**
 * Traverse up a file path and search for the given file name.
 *
 * @param start File or folder path to start searching from
 * @param fileName File name to search for
 */
export function searchUp(
  start: SourcePath,
  fileName: string
): string | undefined {
  const filePath = path.join(start, fileName);
  if (fs.existsSync(filePath)) {
    return filePath;
  }
  const parent = path.resolve(start, '..');
  if (parent === start) {
    return;
  }
  return searchUp(parent, fileName);
}

/**
 * Walk a given directory path and collect the files.
 *
 * @param dir Directory to walk
 * @param ignore Optional paths to ignore
 */
export function walk(dir: SourcePath, ignore?: Set<SourcePath>): SourcePath[] {
  const paths: SourcePath[] = [];
  for (const file of fs.readdirSync(dir)) {
    const p = path.join(dir, file);
    if (isDirectory(p)) {
      paths.push(...walk(p, ignore));
    } else if (!ignore || !ignore.has(p)) {
      paths.push(p);
    }
  }
  return paths;
}
