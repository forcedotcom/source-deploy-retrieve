/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { dirname, basename, join } from 'node:path';
import { Messages, SfError } from '@salesforce/core';
import { ensure } from '@salesforce/ts-types';
import { baseName, parseMetadataXml } from '../../utils/path';
import { SourcePath } from '../../common/types';
import { SourceComponent } from '../sourceComponent';
import { MetadataType } from '../../registry/types';
import { TreeContainer } from '../treeContainers';
import {
  AdapterContext,
  BaseSourceAdapter,
  GetComponent,
  getComponent,
  parseAsRootMetadataXml,
  trimPathToContent,
} from './baseSourceAdapter';

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
      const componentRoot = trimPathToContent(this.type)(trigger);
      return this.tree.find('metadataXml', basename(componentRoot), componentRoot);
    }
    return findMetadataFromContent(this.tree)(this.type)(trigger);
  }

  // it can't *really* be undefined but for subclasses it might be
  protected populate(trigger: SourcePath, component?: SourceComponent): SourceComponent | undefined {
    return populateMixedContent({ tree: this.tree, registry: this.registry, forceIgnore: this.forceIgnore })(this.type)(
      trigger,
      component
    );
  }
}

export const getMixedContentComponent: GetComponent =
  (context) =>
  ({ type, path, isResolvingSource }) => {
    const rootMeta = findMetadataFromContent(context.tree)(type)(path);
    const rootMetaXml = rootMeta ? parseAsRootMetadataXml(type)(rootMeta) : ensure(parseMetadataXml(path));
    const sourceComponent = getComponent(context)({ type, path, metadataXml: rootMetaXml, isResolvingSource });
    return populateMixedContent(context)(type)(path, sourceComponent);
  };

/**
 * A utility for finding a component's root metadata xml from a path to a component's
 * content. "Content" can either be a single file or an entire directory. If the content
 * is a directory, the path can be files or other directories inside of it.
 *
 * Returns undefined if no matching file is found
 *
 * @param path Path to content or a child of the content
 */
const findMetadataFromContent =
  (tree: TreeContainer) =>
  (type: MetadataType) =>
  (path: SourcePath): SourcePath | undefined => {
    const rootContentPath = trimPathToContent(type)(path);
    const rootTypeDirectory = dirname(rootContentPath);
    const contentFullName = baseName(rootContentPath);
    return tree.find('metadataXml', contentFullName, rootTypeDirectory);
  };

export const populateMixedContent =
  (context: AdapterContext) =>
  (type: MetadataType) =>
  (trigger: SourcePath, component?: SourceComponent): SourceComponent => {
    const trimmedPath = trimPathToContent(type)(trigger);
    const contentPath =
      trimmedPath === component?.xml
        ? context.tree.find('content', baseName(trimmedPath), dirname(trimmedPath))
        : trimmedPath;

    // Content path might be undefined for staticResource where all files are ignored and only the xml is included.
    // Note that if contentPath is a directory that is not ignored, but all the files within it are
    // ignored (or it's an empty dir) contentPath will be truthy and the error will not be thrown.
    if (!contentPath || !context.tree.exists(contentPath)) {
      throw new SfError(
        messages.getMessage('error_expected_source_files', [trigger, type.name]),
        'ExpectedSourceFilesError'
      );
    }

    if (component) {
      component.content = contentPath;
      return component;
    } else {
      return new SourceComponent(
        {
          name: baseName(contentPath),
          type,
          content: contentPath,
          xml: type.metaFileSuffix && join(contentPath, type.metaFileSuffix),
        },
        context.tree,
        context.forceIgnore
      );
    }
  };
