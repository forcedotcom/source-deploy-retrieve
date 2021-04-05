/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { BaseSourceAdapter } from './baseSourceAdapter';
import { SourcePath } from '../../common';
import { SourceComponent } from '../sourceComponent';

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
  protected metadataWithContent = false;

  /* istanbul ignore next */
  protected getRootMetadataXmlPath(trigger: string): SourcePath {
    // istanbul ignored for code coverage since this return won't ever be hit,
    // unless future changes permit otherwise. Remove the ignore and these comments
    // if this method is expected to be entered.
    return trigger;
  }

  protected populate(trigger: SourcePath, component: SourceComponent): SourceComponent {
    return component;
  }
}
