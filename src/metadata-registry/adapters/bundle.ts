/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  SourceAdapter,
  MetadataType,
  SourcePath,
  MetadataComponent,
  MetadataXml
} from '../types';
import { RegistryAccess } from '../registry';
import { sep, join, dirname, basename } from 'path';
import { readdirSync } from 'fs';
import { parseMetadataXml, walk, findMetadataXml } from '../util';
import { META_XML_SUFFIX } from '../constants';
import { BaseSourceAdapter } from './base';
import { MixedContent } from './mixedContent';

/**
 * Handles _bundle_ types. A component bundle has all its source files, including the
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
export class Bundle extends MixedContent {
  protected getMetadataXmlPath(pathToSource: SourcePath): SourcePath {
    // Bundles are MixedContent, but the -meta.xml is located in the component's folder.
    const bundleRootPath = this.getPathToContent(pathToSource);
    return findMetadataXml(bundleRootPath, basename(bundleRootPath));
  }
}
