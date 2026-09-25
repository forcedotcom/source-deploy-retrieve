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
import { join } from 'node:path';
import { DEFAULT_PACKAGE_ROOT_SFDX } from '../../common/constants';
import { SourcePath } from '../../common/types';
import { trimUntil } from '../../utils/path';
import { getReplacementStreamForReadable } from '../replacements';
import { WriteInfo } from '../types';
import { SourceComponent } from '../../resolve/sourceComponent';
import { BaseMetadataTransformer } from './baseMetadataTransformer';

// The dataspace wrapper directory that must be preserved on disk and in the mdapi package.
const DATASPACE_ROOT = 'dataSpaces';

/**
 * Transformer for Data Cloud dataspace-scoped types (CalculatedInsight, DataModelObject).
 *
 * These are single generic `.json` files nested under a `dataSpaces/<dataspace>/<typeDir>/`
 * wrapper. The stock `calculateRelativePath` would collapse that path to
 * `<typeDir>/<name>.json` (dropping the `dataSpaces/<dataspace>/` prefix), so this transformer
 * instead preserves the whole path from `dataSpaces/` down. The layout is identical in both
 * directions:
 *
 * - source format:   `main/default/dataSpaces/<ds>/<typeDir>/<name>.json`
 * - metadata format: `dataSpaces/<ds>/<typeDir>/<name>.json`
 */
export class DataspaceScopedMetadataTransformer extends BaseMetadataTransformer {
  // eslint-disable-next-line @typescript-eslint/require-await, class-methods-use-this
  public async toMetadataFormat(component: SourceComponent): Promise<WriteInfo[]> {
    return getWriteInfos(component, 'metadata');
  }

  // eslint-disable-next-line @typescript-eslint/require-await, class-methods-use-this
  public async toSourceFormat({ component }: { component: SourceComponent }): Promise<WriteInfo[]> {
    return getWriteInfos(component, 'source');
  }
}

const getWriteInfos = (component: SourceComponent, targetFormat: 'source' | 'metadata'): WriteInfo[] =>
  component.walkContent().map((path) => ({
    source: getReplacementStreamForReadable(component, path),
    output: getDataspaceScopedDestination(path, targetFormat),
  }));

/**
 * Build the destination path preserving the `dataSpaces/<ds>/<typeDir>/<name>.json` structure.
 * Source format is rooted under `main/default`; metadata format keeps it at the package root.
 */
const getDataspaceScopedDestination = (source: SourcePath, targetFormat: 'source' | 'metadata'): SourcePath => {
  const base = targetFormat === 'source' ? DEFAULT_PACKAGE_ROOT_SFDX : '';
  // trimUntil keeps the path from `dataSpaces` onward (including the dataspace + type dirs + file).
  return join(base, trimUntil(source, DATASPACE_ROOT, true));
};
