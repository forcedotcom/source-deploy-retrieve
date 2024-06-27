/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { basename } from 'node:path';
import { ensure } from '@salesforce/ts-types';
import { parseMetadataXml } from '../../utils';
import { SourcePath } from '../../common/types';
import { SourceComponent } from '../sourceComponent';
import { TreeContainer } from '../treeContainers';
import { MaybeGetComponent, getComponent, parseAsRootMetadataXml, trimPathToContent } from './baseSourceAdapter';
import { MixedContentSourceAdapter, populateMixedContent } from './mixedContentSourceAdapter';

/**
 * Handles _bundle_ types. A bundle component has all its source files, including the
 * root metadata xml, contained in its own directory.
 *
 * __Example Types__:
 *
 * LightningComponentBundle, AuraDefinitionBundle, CustomObject
 *
 * __Example Structure__:
 * ```text
 * foos/
 * ├── myFoo/
 * |   ├── myFoo.js
 * |   ├── myFooStyle.css
 * |   ├── myFoo.html
 * |   ├── myFoo.js-meta.xml
 *```
 */
export class BundleSourceAdapter extends MixedContentSourceAdapter {
  protected ownFolder = true;

  /**
   * Excludes empty bundle directories.
   *
   * e.g.
   * lwc/
   * ├── myFoo/
   * |   ├── myFoo.js
   * |   ├── myFooStyle.css
   * |   ├── myFoo.html
   * |   ├── myFoo.js-meta.xml
   * ├── emptyLWC/
   *
   * so we shouldn't populate with the `emptyLWC` directory
   *
   * @param trigger Path that `getComponent` was called with
   * @param component Component to populate properties on
   * @protected
   */
  protected populate(trigger: SourcePath, component?: SourceComponent): SourceComponent | undefined {
    if (this.tree.isDirectory(trigger) && !this.tree.readDirectory(trigger)?.length) {
      // if it's an empty directory, don't include it (e.g., lwc/emptyLWC)
      return;
    }
    return super.populate(trigger, component);
  }
}

export const getBundleComponent: MaybeGetComponent =
  (context) =>
  ({ type, path, isResolvingSource }) => {
    // if it's an empty directory, don't include it (e.g., lwc/emptyLWC)
    if (isEmptyDirectory(context.tree)(path)) return;
    const componentRoot = trimPathToContent(type)(path);
    const rootMeta = context.tree.find('metadataXml', basename(componentRoot), componentRoot);
    const rootMetaXml = rootMeta ? parseAsRootMetadataXml(type)(rootMeta) : ensure(parseMetadataXml(path));
    const sourceComponent = getComponent(context)({ type, path, metadataXml: rootMetaXml, isResolvingSource });
    return populateMixedContent(context)(type)(path, sourceComponent);
  };

const isEmptyDirectory =
  (tree: TreeContainer) =>
  (fsPath: SourcePath): boolean =>
    tree.isDirectory(fsPath) && !tree.readDirectory(fsPath)?.length;
