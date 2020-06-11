/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { MixedContent } from './mixedContent';
import { SourcePath, MetadataComponent } from '../../types';
import { findMetadataXml, parseMetadataXml } from '../../utils/registry';
import { basename, join, dirname } from 'path';
import { readdirSync } from 'fs';
import { isDirectory } from '../../utils/fileSystemHandler';
import { baseName } from '../../utils';

export class Decomposed extends MixedContent {
  protected getMetadataXmlPath(pathToSource: SourcePath): SourcePath {
    const componentRoot = this.getPathToContent(pathToSource);
    return findMetadataXml(componentRoot, basename(componentRoot));
  }

  protected getSourcePaths(): SourcePath[] | undefined {
    return undefined;
  }

  protected getChildren(xmlPath: SourcePath): MetadataComponent[] | undefined {
    return this._getChildren(dirname(xmlPath));
  }

  private _getChildren(dirPath: SourcePath): MetadataComponent[] {
    const children: MetadataComponent[] = [];
    for (const fileName of readdirSync(dirPath)) {
      const currentPath = join(dirPath, fileName);
      if (this.forceIgnore.denies(currentPath)) {
        continue;
      } else if (isDirectory(currentPath)) {
        children.push(...this._getChildren(currentPath));
      } else {
        const childXml = parseMetadataXml(fileName);
        // second condition ensures we don't add the parent's metadata xml as a child
        if (childXml && childXml.suffix !== this.type.suffix) {
          // TODO: Log warning if missing child type definition
          const childTypeId = this.type.children.suffixes[childXml.suffix];
          children.push({
            fullName: baseName(fileName),
            type: this.type.children.types[childTypeId],
            xml: currentPath
          });
        }
      }
    }
    return children;
  }
}
