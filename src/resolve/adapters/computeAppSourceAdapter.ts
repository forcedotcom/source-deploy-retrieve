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
import { basename, dirname } from 'node:path';
import { SourcePath } from '../../common/types';
import { SourceComponent } from '../sourceComponent';
import { BundleSourceAdapter } from './bundleSourceAdapter';

/**
 * Handles ComputeApp. Source format is a bundle folder; metadata format (what the org
 * returns) is a single flat xml file with no folder, because the app source travels
 * through the Elastic Compute transport rather than the Metadata API.
 *
 * __Source Structure__:
 * ```text
 * computeApps/
 * ├── myApp/
 * |   ├── myApp.computeApp-meta.xml
 * |   ├── package.json
 * |   ├── src/...
 * ```
 *
 * __Metadata Structure__:
 * ```text
 * computeApps/
 * ├── myApp.computeApp
 * ```
 */
export class ComputeAppSourceAdapter extends BundleSourceAdapter {
  // lets the resolver hand us the flat metadata-format file
  protected metadataWithContent = false;

  public getComponent(path: SourcePath, isResolvingSource = true): SourceComponent | undefined {
    const suffix = `.${this.type.suffix ?? ''}`;
    if (path.endsWith(suffix) && basename(dirname(path)) === this.type.directoryName && !this.tree.isDirectory(path)) {
      return new SourceComponent(
        { name: basename(path, suffix), type: this.type, xml: path },
        this.tree,
        this.forceIgnore
      );
    }
    return super.getComponent(path, isResolvingSource);
  }
}
