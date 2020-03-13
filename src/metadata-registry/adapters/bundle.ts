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
 * Handles _bundle_ types. A bundle is a component that has all its source files, including the
 * `-meta.xml` file, contained in its own directory.
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
    // Bundles are basically just MixedContent, but the -meta.xml is located in the
    // component's folder.
    const bundleRootPath = this.getPathToContent(pathToSource);
    return findMetadataXml(bundleRootPath, basename(bundleRootPath));
  }
}
