/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { basename, dirname, extname, sep } from 'path';
import { SourcePath } from '../common';
import { MetadataXml } from '../resolve';

/**
 * Get the file or directory name at the end of a path. Different from `path.basename`
 * in that it strips anything after the first '.' in the name.
 * @param fsPath The path to evaluate
 */
export function baseName(fsPath: SourcePath): string {
  return basename(fsPath).split('.')[0];
}

/**
 * Get the name of file path extension. Different from path.extname in that it
 * does not include the '.' in the extension name. Returns an empty string if
 * there is no extension.
 * @param fsPath The path to evaluate
 */
export function extName(fsPath: SourcePath): string {
  const split = extname(fsPath).split('.');
  return split.length > 1 ? split[1] : split[0];
}

/**
 * Get the name of the parent to the last portion of a path
 * @param fsPath The path to evaluate
 */
export function parentName(fsPath: SourcePath): string {
  return basename(dirname(fsPath));
}

/**
 * Trim a path up until and including the given part. Returns `fsPath`
 * if the path `part` was not found.
 * @param fsPath Path to trim
 * @param part Path part to trim up until
 */
export function trimUntil(fsPath: SourcePath, part: string): string {
  const parts = fsPath.split(sep);
  const partIndex = parts.findIndex((p) => part === p);
  if (partIndex === -1) {
    return fsPath;
  }
  return parts.slice(partIndex).join(sep);
}

/**
 * Returns the `MetadataXml` info from a given file path. If the path is not a
 * metadata xml file (-meta.xml), returns `undefined`.
 *
 * @param fsPath - File path to parse
 * @returns MetadataXml info or undefined
 */
export function parseMetadataXml(fsPath: string): MetadataXml | undefined {
  const match = basename(fsPath).match(/(.+)\.(.+)-meta\.xml/);
  if (match) {
    return { fullName: match[1], suffix: match[2], path: fsPath };
  }
}
