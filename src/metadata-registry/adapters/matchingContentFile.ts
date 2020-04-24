/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { META_XML_SUFFIX } from '../constants';
import { existsSync } from 'fs';
import { BaseSourceAdapter } from './base';
import { ExpectedSourceFilesError, UnexpectedForceIgnore } from '../../errors';
import { SourcePath } from '../../types';
import { extName } from '../../utils/path';

/**
 * Handles types with a single content file with a matching file extension.
 * These tend to be the programmatic types.
 *
 * __Example Types__:
 *
 * ApexClass, ApexTrigger, ApexComponent
 *
 * __Example Structure__:
 *
 * ```text
 * foos/
 * ├── foobar.ext
 * ├── foobar.ext-meta.xml
 *```
 */
export class MatchingContentFile extends BaseSourceAdapter {
  protected getMetadataXmlPath(pathToSource: SourcePath): SourcePath {
    return `${pathToSource}${META_XML_SUFFIX}`;
  }

  protected getSourcePaths(
    fsPath: SourcePath,
    isMetaXml: boolean
  ): SourcePath[] {
    let sourcePath: SourcePath;
    if (isMetaXml) {
      const path = fsPath.slice(0, fsPath.lastIndexOf(META_XML_SUFFIX));
      if (existsSync(path)) {
        sourcePath = path;
      }
    } else if (this.registry.suffixes[extName(fsPath)]) {
      sourcePath = fsPath;
    }
    if (!sourcePath) {
      throw new ExpectedSourceFilesError(this.type, fsPath);
    } else if (this.forceIgnore.denies(sourcePath)) {
      throw new UnexpectedForceIgnore('error_no_source_ignore', [
        this.type.name,
        sourcePath
      ]);
    }
    return [sourcePath];
  }
}
