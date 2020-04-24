/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { BaseSourceAdapter } from './base';
import { sep, dirname } from 'path';
import {
  parseMetadataXml,
  findMetadataXml,
  findMetadataContent
} from '../../utils/registry';
import { ExpectedSourceFilesError } from '../../errors';
import { existsSync } from 'fs';
import { isDirectory, walk } from '../../utils/fileSystemHandler';
import { baseName } from '../../utils/path';
import { SourcePath, MetadataType } from '../../types';

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
    return MixedContent.findXmlFromContentPath(pathToSource, this.type);
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

    if (!existsSync(contentPath)) {
      throw new ExpectedSourceFilesError(this.type, fsPath);
    }

    const sources = isDirectory(contentPath)
      ? walk(contentPath, ignore)
      : [contentPath];
    return sources.filter(s => this.forceIgnore.accepts(s));
  }

  protected getPathToContent(source: SourcePath): SourcePath {
    const pathParts = source.split(sep);
    const typeFolderIndex = pathParts.findIndex(
      part => part === this.type.directoryName
    );
    const offset = this.type.inFolder ? 3 : 2;
    return pathParts.slice(0, typeFolderIndex + offset).join(sep);
  }

  /**
   * A utility for finding a component's root metadata xml from a path to a component's
   * content. "Content" can either be a single file or an entire directory. If the content
   * is a directory, the path can be files or other directories inside of it.
   * @param source
   */
  public static findXmlFromContentPath(
    contentPath: SourcePath,
    type: MetadataType
  ): SourcePath {
    const pathParts = contentPath.split(sep);
    const typeFolderIndex = pathParts.findIndex(
      part => part === type.directoryName
    );
    const offset = type.inFolder ? 3 : 2;
    const rootContentPath = pathParts
      .slice(0, typeFolderIndex + offset)
      .join(sep);
    const rootTypeDirectory = dirname(rootContentPath);
    const contentFullName = baseName(rootContentPath);
    return findMetadataXml(rootTypeDirectory, contentFullName);
  }
}
