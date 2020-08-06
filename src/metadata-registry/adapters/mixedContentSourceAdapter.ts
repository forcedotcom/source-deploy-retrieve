/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { BaseSourceAdapter } from './baseSourceAdapter';
import { dirname, basename, sep } from 'path';
import { ExpectedSourceFilesError } from '../../errors';
import { baseName } from '../../utils/path';
import { SourcePath, MetadataType } from '../../common';
import { TreeContainer } from '../../types';
import { SourceComponent } from '../sourceComponent';

/**
 * Handles types with mixed content. Mixed content means there are one or more additional
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
export class MixedContentSourceAdapter extends BaseSourceAdapter {
  protected getRootMetadataXmlPath(trigger: SourcePath): SourcePath {
    if (this.ownFolder) {
      const componentRoot = MixedContentSourceAdapter.trimPathToContent(trigger, this.type);
      return this.tree.find('metadata', basename(componentRoot), componentRoot);
    }
    return MixedContentSourceAdapter.findMetadataFromContent(trigger, this.type, this.tree);
  }

  protected populate(component: SourceComponent, trigger: SourcePath): SourceComponent {
    let contentPath = MixedContentSourceAdapter.trimPathToContent(trigger, this.type);
    if (contentPath === component.xml) {
      contentPath = this.tree.find('content', baseName(contentPath), dirname(contentPath));
    }

    if (!this.tree.exists(contentPath)) {
      throw new ExpectedSourceFilesError(this.type, trigger);
    }

    component.content = contentPath;

    return component;
  }

  /**
   * A utility for finding a component's root metadata xml from a path to a component's
   * content. "Content" can either be a single file or an entire directory. If the content
   * is a directory, the path can be files or other directories inside of it.
   *
   * @param path Path to content or a child of the content
   */
  public static findMetadataFromContent(
    path: SourcePath,
    type: MetadataType,
    tree: TreeContainer
  ): SourcePath {
    const rootContentPath = MixedContentSourceAdapter.trimPathToContent(path, type);
    const rootTypeDirectory = dirname(rootContentPath);
    const contentFullName = baseName(rootContentPath);
    return tree.find('metadata', contentFullName, rootTypeDirectory);
  }

  /**
   * Trim a path up until the root of a component's content. If the content is a file,
   * the given path will be returned back. If the content is a folder, the path to that
   * folder will be returned. Intended to be used exclusively for MixedContent types.
   *
   * @param path Path to trim
   * @param type MetadataType to determine content for
   */
  private static trimPathToContent(path: SourcePath, type: MetadataType): SourcePath {
    const pathParts = path.split(sep);
    const typeFolderIndex = pathParts.findIndex((part) => part === type.directoryName);
    const offset = type.inFolder ? 3 : 2;
    return pathParts.slice(0, typeFolderIndex + offset).join(sep);
  }
}
