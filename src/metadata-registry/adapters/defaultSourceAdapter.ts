/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { BaseSourceAdapter } from './baseSourceAdapter';
import { MetadataComponent, SourcePath } from '../../types';

/**
 * The default source adapter. Handles simple types with no additional content.
 *
 * __Example Types__:
 *
 * Layouts, PermissionSets, FlexiPages
 *
 * __Example Structure__:
 * ```text
 * foos/
 * ├── foo.ext-meta.xml
 * ├── bar.ext-meta.xml
 *```
 */
export class DefaultSourceAdapter extends BaseSourceAdapter {
  /* istanbul ignore next */
  // ignored for code coverage since this method won't ever be executed, unless future
  // changes permit otherwise. Remove the comments if this method is expected to be entered.
  protected getRootMetadataXmlPath(trigger: string): SourcePath {
    return trigger;
  }

  protected populate(component: MetadataComponent): MetadataComponent {
    return component;
  }
}
