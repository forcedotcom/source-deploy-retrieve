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
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
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

  public async toSourceFormat({ component }: { component: SourceComponent }): Promise<WriteInfo[]> {
    const infos = getWriteInfos(component, 'source');
    const { defaultDirectory } = this;
    if (!defaultDirectory) {
      return infos;
    }
    const sidecars = new Map(getSidecars(component).map((sidecar) => [getD360Destination(sidecar, 'source'), sidecar]));
    return Promise.all(
      infos.map(async (info) => {
        const sidecar = sidecars.get(info.output);
        return sidecar
          ? mergeWithLocalSidecar((await component.tree.readFile(sidecar)).toString('utf8'), info, defaultDirectory)
          : info;
      })
    );
  }
}

/** The `<name>.meta.json` sidecar of each payload file the component has one for. */
const getSidecars = (component: SourceComponent): SourcePath[] =>
  component
    .walkContent()
    .map((path) => path.replace(/\.json$/, METADATA_SIDECAR_SUFFIX))
    .filter((sidecar) => sidecar.endsWith(METADATA_SIDECAR_SUFFIX) && component.tree.exists(sidecar));

const getWriteInfos = (component: SourceComponent, targetFormat: 'source' | 'metadata'): WriteInfo[] =>
  // walkContent() yields only the payload file(s), so their sidecars are added to write both halves of each pair.
  [...component.walkContent(), ...getSidecars(component)].map((path) => ({
    source: getReplacementStreamForReadable(component, path),
    output: getD360Destination(path, targetFormat),
  }));

/**
 * Merge a retrieved sidecar into the one already in the project, if any. The retrieved sidecar is
 * written unchanged when there is no local one or nothing in it needs keeping.
 */
const mergeWithLocalSidecar = async (
  retrieved: string,
  info: WriteInfo,
  defaultDirectory: string
): Promise<WriteInfo> => {
  let local: string;
  try {
    local = await readFile(join(defaultDirectory, info.output), 'utf8');
  } catch {
    return info;
  }
  const merged = mergeSidecars(local, retrieved);
  return merged === retrieved ? info : { output: info.output, source: Readable.from(merged) };
};

type SidecarRef = { componentType?: string; name?: string; dataspaceName?: string };
type Sidecar = { dataspaceName?: string; retrieveWith?: SidecarRef[] };

/**
 * A component outside any dataspace (e.g. a Data Lake Object) has one sidecar on disk but can be
 * retrieved once per dataspace, and each retrieve only reports the peers of the dataspace it was run
 * for. Rather than letting the latest retrieve overwrite the others, keep the existing peers of every
 * dataspace the new retrieve didn't cover and take the rest from the new sidecar.
 */
export const mergeSidecars = (existingJson: string, incomingJson: string): string => {
  let existing: Sidecar;
  let incoming: Sidecar;
  try {
    existing = JSON.parse(existingJson) as Sidecar;
    incoming = JSON.parse(incomingJson) as Sidecar;
  } catch {
    return incomingJson;
  }
  const incomingPeers = incoming.retrieveWith ?? [];
  const covered = new Set([incoming.dataspaceName, ...incomingPeers.map((ref) => ref.dataspaceName)].filter(Boolean));
  const keyOf = (ref: SidecarRef): string => `${ref.componentType ?? ''}|${ref.dataspaceName ?? ''}|${ref.name ?? ''}`;
  const incomingKeys = new Set(incomingPeers.map(keyOf));
  const kept = (existing.retrieveWith ?? []).filter(
    (ref) => ref.dataspaceName && !covered.has(ref.dataspaceName) && !incomingKeys.has(keyOf(ref))
  );
  if (!kept.length) {
    return incomingJson;
  }
  return `${JSON.stringify({ ...incoming, retrieveWith: [...kept, ...incomingPeers] }, null, 2)}\n`;
};

/**
 * Build the destination path preserving the `d360/dataspace/<ds>/<typeDir>/<name>.json` structure.
 * Source format is rooted under `main/default`; metadata format keeps it at the package root.
 */
const getD360Destination = (source: SourcePath, targetFormat: 'source' | 'metadata'): SourcePath => {
  const base = targetFormat === 'source' ? DEFAULT_PACKAGE_ROOT_SFDX : '';
  // trimUntil keeps the path from `d360` onward (dataspace wrapper + type dir + file).
  return join(base, trimUntil(source, DATASPACE_ROOT, true));
};
