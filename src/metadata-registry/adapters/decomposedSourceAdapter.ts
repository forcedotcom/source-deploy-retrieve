/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { MixedContentSourceAdapter } from './mixedContentSourceAdapter';
import { SourcePath } from '../../common';
import { parseMetadataXml } from '../../utils/registry';
import { SourceComponent } from '../sourceComponent';
import { baseName } from '../../utils';
import { DecompositionStrategy } from '../types';

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
 *
 * foos/
 * ├── MyFoo__c/
 * |   ├── a.bar-meta.xml
 * |   ├── MyFoo__c.foo-meta.xml
 * |   ├── b.bar-meta.xml
 * |   ├── c.bar-meta.xml
 *```
 */
export class DecomposedSourceAdapter extends MixedContentSourceAdapter {
  protected ownFolder = true;
  protected metadataWithContent = false;

  /**
   * If the trigger turns out to be part of a child component, `populate` will build
   * the child component, set its parent property to the one created by the
   * `BaseSourceAdapter`, and return the child component instead.
   */
  protected populate(
    trigger: SourcePath,
    component?: SourceComponent,
    isResolvingSource?: boolean
  ): SourceComponent {
    const metaXml = parseMetadataXml(trigger);
    if (metaXml) {
      const pathToContent = this.trimPathToContent(trigger);
      const childTypeId = this.type.children.suffixes[metaXml.suffix];
      const triggerIsAChild = !!childTypeId;
      const strategy = this.type.strategies.decomposition;
      if (
        triggerIsAChild &&
        (strategy === DecompositionStrategy.FolderPerType || isResolvingSource)
      ) {
        let parent = component;
        if (!parent) {
          parent = new SourceComponent(
            {
              name: baseName(pathToContent),
              type: this.type,
            },
            this.tree,
            this.forceIgnore
          );
        }
        parent.content = pathToContent;
        return new SourceComponent(
          {
            name: metaXml.fullName,
            type: this.type.children.types[childTypeId],
            xml: trigger,
            parent,
          },
          this.tree,
          this.forceIgnore
        );
      }
      if (!triggerIsAChild) {
        component.content = pathToContent;
      }
    }
    return component;
  }
}
