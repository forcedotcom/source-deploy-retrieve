/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { dirname, join } from 'node:path';
import { Messages, SfError } from '@salesforce/core';
import { baseName, parseMetadataXml } from '../../utils/path';
import { SourcePath } from '../../common/types';
import { SourceComponent } from '../sourceComponent';
import { MetadataType } from '../../registry/types';
import { TreeContainer } from '../treeContainers';
import { getComponent, parseAsRootMetadataXml, trimPathToContent } from './baseSourceAdapter';
import { AdapterContext } from './types';
import { GetComponent } from './types';

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
export const getMixedContentComponent: GetComponent =
  (context) =>
  ({ type, path }) => {
    const rootMeta = findMetadataFromContent(context.tree)(type)(path);
    const rootMetaXml = rootMeta ? parseAsRootMetadataXml(type)(rootMeta) : parseMetadataXml(path);
    const sourceComponent = getComponent(context)({ type, path, metadataXml: rootMetaXml });
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
  (path: SourcePath, component?: SourceComponent): SourceComponent => {
    const trimmedPath = trimPathToContent(type)(path);
    const contentPath =
      trimmedPath === component?.xml
        ? context.tree.find('content', baseName(trimmedPath), dirname(trimmedPath))
        : trimmedPath;

    // Content path might be undefined for staticResource where all files are ignored and only the xml is included.
    // Note that if contentPath is a directory that is not ignored, but all the files within it are
    // ignored (or it's an empty dir) contentPath will be truthy and the error will not be thrown.
    if (
      !contentPath ||
      !context.tree.exists(contentPath) ||
      (context.forceIgnore && (context.forceIgnore.denies(contentPath) || context.forceIgnore.denies(path)))
    ) {
      throw new SfError(
        messages.getMessage('error_expected_source_files', [path, type.name]),
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
