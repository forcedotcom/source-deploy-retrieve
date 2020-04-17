/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { basename, dirname, extname } from 'path';
import { SourcePath } from '../types';

/**
 * Get the name of the parent to the last portion of a path
 * @param fsPath The path to evaluate
 */
export function parentName(fsPath: SourcePath): string {
  return basename(dirname(fsPath));
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
