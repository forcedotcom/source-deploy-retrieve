/*
 * Copyright 2026, Salesforce, Inc.
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
import { BaseSourceAdapter } from './baseSourceAdapter';

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
  // retained to preserve API
  // eslint-disable-next-line class-methods-use-this
  protected getRootMetadataXmlPath(trigger: string): SourcePath {
    // istanbul ignored for code coverage since this return won't ever be hit,
    // unless future changes permit otherwise. Remove the ignore and these comments
    // if this method is expected to be entered.
    return trigger;
  }

  // retained to preserve API
  // eslint-disable-next-line class-methods-use-this
  protected populate(trigger: SourcePath, component: SourceComponent): SourceComponent {
    return component;
  }
}
