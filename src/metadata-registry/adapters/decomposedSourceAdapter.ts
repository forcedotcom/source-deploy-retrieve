/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { MixedContentSourceAdapter } from './mixedContentSourceAdapter';
import { SourcePath, MetadataComponent } from '../../types';
import { parseMetadataXml } from '../../utils/registry';
import { join, dirname } from 'path';
import { readdirSync } from 'fs';
import { isDirectory } from '../../utils/fileSystemHandler';
import { baseName } from '../../utils';

/**
 * Handles decomposed types. A flavor of mixed content where a component can
 * have additional -meta.xml files that represent child components of the main
 * component.
 *
 * __Example Types__:
 *
 * CustomObject, CustomObjectTranslation
 *
 * __Example Structures__:
 *
 *```text
 * foos/
 * ├── MyFoo__c/
 * |   ├── MyFoo__c.foo-meta.xml
 * |   ├── bars/
 * |      ├── a.bar-meta.xml
 * |      ├── b.bar-meta.xml
 * |      ├── c.bar-meta.xml
 *```
 */
export class DecomposedSourceAdapter extends MixedContentSourceAdapter {
  protected ownFolder = true;

  protected populate(component: MetadataComponent): MetadataComponent {
    const parentPath = dirname(component.xml);
    component.children = this.getChildren(parentPath);
    return component;
  }

  private getChildren(dirPath: SourcePath): MetadataComponent[] {
    const children: MetadataComponent[] = [];
    for (const fileName of readdirSync(dirPath)) {
      const currentPath = join(dirPath, fileName);
      if (this.forceIgnore.denies(currentPath)) {
        continue;
      } else if (isDirectory(currentPath)) {
        children.push(...this.getChildren(currentPath));
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
