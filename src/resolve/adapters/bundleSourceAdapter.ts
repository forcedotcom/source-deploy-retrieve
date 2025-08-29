/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { SourcePath } from '../../common/types';
import { SourceComponent } from '../sourceComponent';
import { MixedContentSourceAdapter } from './mixedContentSourceAdapter';

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
