/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { BaseSourceAdapter } from './baseSourceAdapter';
import { dirname, basename } from 'path';
import { findMetadataXml, findMetadataContent } from '../../utils/registry';
import { ExpectedSourceFilesError } from '../../errors';
import { existsSync } from 'fs';
import { isDirectory, walk } from '../../utils/fileSystemHandler';
import { baseName, getPathToContent } from '../../utils/path';
import { SourcePath, MetadataType, MetadataComponent } from '../../types';

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
      // self contained components have all their files in their own folder
      const componentRoot = getPathToContent(trigger, this.type);
      return findMetadataXml(componentRoot, basename(componentRoot));
    }
    return MixedContentSourceAdapter.findXmlFromContentPath(trigger, this.type);
  }

  protected populate(component: MetadataComponent, trigger: SourcePath): MetadataComponent {
    let contentPath = getPathToContent(trigger, this.type);
    // TODO: can this be more self explaining?
    if (!this.ownFolder) {
      contentPath = findMetadataContent(dirname(contentPath), baseName(contentPath));
    }

    if (!existsSync(contentPath)) {
      throw new ExpectedSourceFilesError(this.type, trigger);
    }

    const ignore = new Set<SourcePath>([component.xml]);
    const sources = isDirectory(contentPath) ? walk(contentPath, ignore) : [contentPath];
    component.sources = sources.filter(s => this.forceIgnore.accepts(s));
    return component;
  }

  /**
   * A utility for finding a component's root metadata xml from a path to a component's
   * content. "Content" can either be a single file or an entire directory. If the content
   * is a directory, the path can be files or other directories inside of it.
   * @param source
   */
  public static findXmlFromContentPath(contentPath: SourcePath, type: MetadataType): SourcePath {
    const rootContentPath = getPathToContent(contentPath, type);
    const rootTypeDirectory = dirname(rootContentPath);
    const contentFullName = baseName(rootContentPath);
    return findMetadataXml(rootTypeDirectory, contentFullName);
  }
}
