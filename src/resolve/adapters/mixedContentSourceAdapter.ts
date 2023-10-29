/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { dirname, basename, sep, join } from 'node:path';
import { Messages, SfError } from '@salesforce/core';
import { baseName } from '../../utils/path';
import { SourcePath } from '../../common';
import { SourceComponent } from '../sourceComponent';
import { BaseSourceAdapter } from './baseSourceAdapter';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');
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
  /**
   *
   * Returns undefined if no matching file is found
   */
  protected getRootMetadataXmlPath(trigger: SourcePath): SourcePath | undefined {
    if (this.ownFolder) {
      const componentRoot = this.trimPathToContent(trigger);
      return this.tree.find('metadataXml', basename(componentRoot), componentRoot);
    }
    return this.findMetadataFromContent(trigger);
  }

  protected populate(trigger: SourcePath, component?: SourceComponent): SourceComponent | undefined {
    const trimmedPath = this.trimPathToContent(trigger);
    const contentPath =
      trimmedPath === component?.xml
        ? this.tree.find('content', baseName(trimmedPath), dirname(trimmedPath))
        : trimmedPath;

    // Content path might be undefined for staticResource where all files are ignored and only the xml is included.
    // Note that if contentPath is a directory that is not ignored, but all the files within it are
    // ignored (or it's an empty dir) contentPath will be truthy and the error will not be thrown.
    if (!contentPath || !this.tree.exists(contentPath)) {
      throw new SfError(
        messages.getMessage('error_expected_source_files', [trigger, this.type.name]),
        'ExpectedSourceFilesError'
      );
    }

    if (component) {
      component.content = contentPath;
    } else {
      component = new SourceComponent(
        {
          name: baseName(contentPath),
          type: this.type,
          content: contentPath,
          xml: this.type.metaFileSuffix && join(contentPath, this.type.metaFileSuffix),
        },
        this.tree,
        this.forceIgnore
      );
    }

    return component;
  }

  /**
   * Trim a path up until the root of a component's content. If the content is a file,
   * the given path will be returned back. If the content is a folder, the path to that
   * folder will be returned. Intended to be used exclusively for MixedContent types.
   *
   * @param path Path to trim
   * @param type MetadataType to determine content for
   */
  protected trimPathToContent(path: SourcePath): SourcePath {
    const pathParts = path.split(sep);
    const typeFolderIndex = pathParts.lastIndexOf(this.type.directoryName);
    const offset = this.type.inFolder ? 3 : 2;
    return pathParts.slice(0, typeFolderIndex + offset).join(sep);
  }

  /**
   * A utility for finding a component's root metadata xml from a path to a component's
   * content. "Content" can either be a single file or an entire directory. If the content
   * is a directory, the path can be files or other directories inside of it.
   *
   * Returns undefined if no matching file is found
   *
   * @param path Path to content or a child of the content
   */
  private findMetadataFromContent(path: SourcePath): SourcePath | undefined {
    const rootContentPath = this.trimPathToContent(path);
    const rootTypeDirectory = dirname(rootContentPath);
    const contentFullName = baseName(rootContentPath);
    return this.tree.find('metadataXml', contentFullName, rootTypeDirectory);
  }
}
