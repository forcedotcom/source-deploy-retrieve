/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { BaseSourceAdapter } from './base';
import { SourcePath } from '../types';
import { sep, dirname } from 'path';
import {
  parseMetadataXml,
  walk,
  parseBaseName,
  isDirectory,
  findMetadataXml,
  findMetadataContent
} from '../util';
import { ExpectedSourceFilesError } from '../../errors';

/**
 * Handles types with mixed content. Mixed content means there are one or more source
 * file(s) associated with a component with any file extension. Even an entire folder
 * can be considered "the content".
 *
 * __Example Types__:
 *
 * StaticResources, Documents, Bundle Types
 *
 * __Example Structures__:
 *
 *```text
 * foos/
 * ├── myFoo/
 * |   ├── fooFolder/
 * |      ├── foofighters.x
 * |   ├── foo.y
 * |   ├── fooBar.z
 * ├── myFoo.ext-meta.xml
 * bars/
 * ├── myBar.xyz
 * ├── myBar.ext2-meta.xml
 *```
 */
export class MixedContent extends BaseSourceAdapter {
  protected getMetadataXmlPath(pathToSource: SourcePath): SourcePath {
    const contentPath = this.getPathToContent(pathToSource);
    const rootTypeDirectory = dirname(contentPath);
    const contentFullName = parseBaseName(contentPath);
    return findMetadataXml(rootTypeDirectory, contentFullName);
  }

  protected getSourcePaths(
    fsPath: SourcePath,
    isMetaXml: boolean
  ): SourcePath[] {
    let contentPath;
    const ignore = new Set<SourcePath>();

    if (!isMetaXml) {
      contentPath = this.getPathToContent(fsPath);
      ignore.add(this.getMetadataXmlPath(fsPath));
    } else {
      const metadataXml = parseMetadataXml(fsPath);
      contentPath = findMetadataContent(dirname(fsPath), metadataXml.fullName);
      ignore.add(fsPath);
    }

    const sources = isDirectory(contentPath)
      ? walk(contentPath, ignore)
      : [contentPath];

    if (sources.length === 0) {
      throw new ExpectedSourceFilesError(this.type, fsPath);
    }
    return sources;
  }

  protected getPathToContent(source: SourcePath): SourcePath {
    const pathParts = source.split(sep);
    const typeFolderIndex = pathParts.findIndex(
      part => part === this.type.directoryName
    );
    const offset = this.type.inFolder ? 3 : 2;
    return pathParts.slice(0, typeFolderIndex + offset).join(sep);
  }
}
