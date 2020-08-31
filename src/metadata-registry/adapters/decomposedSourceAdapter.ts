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
  protected metadataWithContent = false;

  /**
   * If the trigger turns out to be part of a child component, `populate` will build
   * the child component, set its parent property to the one created by the
   * `BaseSourceAdapter`, and return the child component instead.
   */
  protected populate(trigger: SourcePath, component: SourceComponent): SourceComponent {
    const metaXml = parseMetadataXml(trigger);
    if (metaXml) {
      const childTypeId = this.type.children.suffixes[metaXml.suffix];
      const triggerIsAChild = !!childTypeId;
      if (triggerIsAChild) {
        let parent = component;
        if (!parent) {
          // create a parent if there isn't one present
          parent = new SourceComponent(
            {
              name: baseName(this.trimPathToContent(trigger)),
              type: this.type,
            },
            this.tree,
            this.forceIgnore
          );
        }
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
    }
    return component;
  }
}
