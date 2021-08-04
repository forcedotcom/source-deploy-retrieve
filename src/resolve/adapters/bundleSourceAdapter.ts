/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { MixedContentSourceAdapter } from './mixedContentSourceAdapter';
import { SourcePath } from '../../common';
import { SourceComponent } from '../sourceComponent';

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
   * filters out empty directories pretending to be valid bundle types
   * e.g.
   * lwc/
   * ├── validLWC/
   * |   ├── myFoo.js
   * |   ├── myFooStyle.css
   * |   ├── myFoo.html
   * |   ├── myFoo.js-meta.xml
   * ├── invalidLWC/
   *
   * so we shouldn't populate with the `invalidLWC` directory
   *
   * @param trigger Path that `getComponent` was called with
   * @param component Component to populate properties on
   * @protected
   */
  protected populate(trigger: SourcePath, component?: SourceComponent): SourceComponent {
    if (this.tree.isDirectory(trigger) && !this.tree.readDirectory(trigger)?.length) {
      // if it's an empty directory, don't include it (lwc/invalidLWC)
      return;
    }
    return super.populate(trigger, component);
  }
}
