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
import { METADATA_SIDECAR_SUFFIX } from '../../resolve/adapters/d360SourceAdapter';
import { getReplacementStreamForReadable } from '../replacements';
import { WriteInfo } from '../types';
import { SourceComponent } from '../../resolve/sourceComponent';
import { BaseMetadataTransformer } from './baseMetadataTransformer';

// The Data Cloud wrapper root that must be preserved on disk and in the mdapi package. The full
// wire path is `d360/dataspace/<ds>/<typeDir>/<name>.json`; we anchor on `d360` so the whole
// dataspace-scoped structure below it is kept verbatim.
const DATASPACE_ROOT = 'd360';

/**
 * Transformer for any Data Cloud dataspace-scoped type. It is type-agnostic — it operates purely on
 * the `d360/dataspace/<dataspace>/<typeDir>/` path shape and the sidecar convention, so it applies
 * unchanged to every dataspace-scoped type; onboarding a new one is a registry change, not a code change.
 *
 * Each component is a PAIR of generic `.json` files nested under a
 * `d360/dataspace/<dataspace>/<typeDir>/` wrapper: the payload `<name>.json` (the component's
 * content) and a `<name>.meta.json` sidecar (`{ componentType, componentName, dataspaceName,
 * retrieveWith, dependsOn }`). The stock `calculateRelativePath` would collapse the path to
 * `<typeDir>/<name>.json` (dropping the `d360/dataspace/<ds>/` prefix), so this transformer instead
 * preserves the whole path from `d360` down and co-writes the sidecar. The layout is identical in
 * both directions:
 *
 * - source format:   `main/default/d360/dataspace/<ds>/<typeDir>/<name>.json` (+ `.meta.json`)
 * - metadata format: `d360/dataspace/<ds>/<typeDir>/<name>.json` (+ `.meta.json`)
 */
export class D360MetadataTransformer extends BaseMetadataTransformer {
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
  // walkContent() yields only the payload file(s); for each we also emit its sibling
  // `<name>.meta.json` sidecar when present, so both halves of the pair are written.
  component.walkContent().flatMap((path) => {
    const infos: WriteInfo[] = [
      {
        source: getReplacementStreamForReadable(component, path),
        output: getD360Destination(path, targetFormat),
      },
    ];
    const sidecar = path.replace(/\.json$/, METADATA_SIDECAR_SUFFIX);
    if (sidecar !== path && component.tree.exists(sidecar)) {
      infos.push({
        source: getReplacementStreamForReadable(component, sidecar),
        output: getD360Destination(sidecar, targetFormat),
      });
    }
    return infos;
  });

/**
 * Build the destination path preserving the `d360/dataspace/<ds>/<typeDir>/<name>.json` structure.
 * Source format is rooted under `main/default`; metadata format keeps it at the package root.
 */
const getD360Destination = (source: SourcePath, targetFormat: 'source' | 'metadata'): SourcePath => {
  const base = targetFormat === 'source' ? DEFAULT_PACKAGE_ROOT_SFDX : '';
  // trimUntil keeps the path from `d360` onward (dataspace wrapper + type dir + file).
  return join(base, trimUntil(source, DATASPACE_ROOT, true));
};
