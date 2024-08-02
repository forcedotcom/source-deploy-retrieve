/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { basename } from 'node:path';
import { parseMetadataXml } from '../../utils';
import { getComponent, parseAsRootMetadataXml, trimPathToContent } from './baseSourceAdapter';
import { MaybeGetComponent } from './types';
import { populateMixedContent } from './mixedContentSourceAdapter';

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

export const getBundleComponent: MaybeGetComponent =
  (context) =>
  ({ type, path }) => {
    // if it's an empty directory, don't include it (e.g., lwc/emptyLWC)
    // TODO: do we really need these exists checks since we're checking isEmptyDirectory?
    if (context.tree.exists(path) && context.tree.isEmptyDirectory(path)) return;
    const componentRoot = trimPathToContent(type)(path);
    if (type.metaFileSuffix) {
      // support for ExperiencePropertyTypeBundle, which doesn't have an xml file.  Calls the mixedContent populate without a component
      return populateMixedContent(context)(type)(componentRoot)(path, undefined);
    }
    const rootMeta = context.tree.find('metadataXml', basename(componentRoot), componentRoot);
    const rootMetaXml = rootMeta ? parseAsRootMetadataXml({ type, path: rootMeta }) : parseMetadataXml(path);
    if (!rootMetaXml) {
      return populateMixedContent(context)(type)(componentRoot)(path, undefined);
    }
    const sourceComponent = getComponent(context)({ type, path, metadataXml: rootMetaXml });
    return populateMixedContent(context)(type)(componentRoot)(path, sourceComponent);
  };
