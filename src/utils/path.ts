/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { basename, dirname, extname, sep } from 'path';
import { SourcePath, MetadataType } from '../types';

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

export function getPathToContent(path: SourcePath, type: MetadataType): SourcePath {
  const pathParts = path.split(sep);
  const typeFolderIndex = pathParts.findIndex(part => part === type.directoryName);
  const offset = type.inFolder ? 3 : 2;
  return pathParts.slice(0, typeFolderIndex + offset).join(sep);
}
