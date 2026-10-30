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
import { Readable } from 'node:stream';
import { RegistryAccess } from '../registry/registryAccess';
import { SourceComponent } from '../resolve/sourceComponent';
import { TreeContainer } from '../resolve/treeContainers';
import { MetadataComponent } from '../resolve/types';
import { SourcePath } from '../common/types';
import {
  METADATA_SIDECAR_SUFFIX,
  parseDataspaceQualifiedName,
  toDataspaceQualifiedName,
} from '../resolve/adapters/d360SourceAdapter';
import { ComponentSet } from './componentSet';

/**
 * Every Data Cloud component is stored as a PAIR of files: a payload `<name>.json` carrying the
 * component's definition, and a `<name>.meta.json` sidecar carrying
 * `{ componentType, componentName, dataspaceName, requires, retrieveWith, dependsOn }`. This module is
 * type-agnostic — it works off the sidecar convention alone, so it covers every Data Cloud type
 * without per-type logic.
 *
 * The sidecar declares TWO distinct relationships, and they mean different things.
 * `retrieveWith` is the list of components that travel together with this one as a single deployable
 * unit — the deploy closure that {@link expandD360ComponentSet} walks. `dependsOn` is informational
 * metadata about what this component references and is NOT used to build the closure.
 *
 * Each `retrieveWith` entry names its target as `{ componentType, name, dataspaceName? }`, where
 * `dataspaceName` is present only for a target inside a dataspace. Resolution matches it against the
 * target's own sidecar, which every type carries regardless of how its payload is shaped. Some types
 * (e.g. Data Lake Objects) live outside any dataspace, under `d360/<typeDir>/`, and are named without one.
 *
 * A component outside any dataspace can still be requested for one dataspace as `<dataspace>.<name>`,
 * the same name retrieve accepts. Its closure is then limited to that dataspace.
 */

/** The adapter strategy id shared by every Data Cloud type. */
const D360_ADAPTER = 'd360';

/** A `retrieveWith` entry. `dataspaceName` is absent when the target is outside every dataspace. */
type ComponentRef = { componentType?: string; name?: string; dataspaceName?: string };

/** One `dependsOn` entry. */
type DependencyRef = { componentType?: string; componentApiName?: string };

type ComponentSidecar = {
  componentType?: string;
  componentName?: string;
  dataspaceName?: string;
  /** Components that deploy together with this one as one unit — drives the deploy closure. */
  retrieveWith?: ComponentRef[];
  /** Informational: what this component references (e.g. source DMOs). Not used for the closure. */
  dependsOn?: { derived?: DependencyRef[]; inbound?: DependencyRef[] };
};

const isD360 = (component: MetadataComponent): boolean => component.type.strategies?.adapter === D360_ADAPTER;

/** A requested name with no local source behind it, e.g. one that still has to be resolved. */
const isNameOnly = (component: MetadataComponent): boolean => !(component instanceof SourceComponent);

const readJson = <T>(component: SourceComponent, path: string | undefined): T | undefined => {
  if (!path || !component.tree.exists(path)) {
    return undefined;
  }
  try {
    return JSON.parse(component.tree.readFileSync(path).toString()) as T;
  } catch {
    return undefined;
  }
};

/** The `<name>.meta.json` sidecar sitting next to the payload content file. */
const getSidecarPath = (component: SourceComponent): string | undefined =>
  component.content?.replace(/\.json$/, METADATA_SIDECAR_SUFFIX);

const readSidecar = (component: SourceComponent): ComponentSidecar | undefined =>
  readJson<ComponentSidecar>(component, getSidecarPath(component));

/**
 * Lookup key for a component reference. The type is part of the key because different types can share
 * a name: a Data Lake Object and its DataspaceMember are both named after the DLO.
 */
const refKey = (componentType: string, name: string): string => `${componentType}|${name}`;

/** Identifies a component across sets; the same component resolved into two sets is two objects. */
const memberKey = (component: MetadataComponent): string => `${component.type.name}|${component.fullName}`;

/**
 * The dataspaces a component outside any dataspace was requested for. A request of
 * `DataLakeObject:default.myDlo__dll` for the local `myDlo__dll` yields `default`.
 */
const getRequestedDataspaces = (requested: ComponentSet, component: SourceComponent): string[] =>
  [...requested]
    .filter((member) => isNameOnly(member) && member.type.name === component.type.name)
    .map((member) => parseDataspaceQualifiedName(member.fullName))
    .filter((parsed) => parsed?.name === component.fullName)
    .map((parsed) => parsed!.dataspace);

/**
 * Resolve `<dataspace>.<name>` requests for components stored outside any dataspace.
 *
 * Retrieve accepts such a name because the org resolves it. Locally the component is stored once,
 * under its bare `<name>`, so the requested name matches no source. This adds the local component for
 * each such request, without a manifest entry of its own, so the manifest keeps the requested name.
 *
 * @param componentSet The set being built; it already holds the requested names.
 * @param fsPaths Package directories to resolve from.
 * @param registry RegistryAccess used to resolve the components.
 */
export const resolveDataspaceQualifiedComponents = (
  componentSet: ComponentSet,
  fsPaths: string[],
  registry: RegistryAccess
): void => {
  const include = new ComponentSet(undefined, registry);
  for (const member of componentSet) {
    const parsed = isD360(member) && isNameOnly(member) ? parseDataspaceQualifiedName(member.fullName) : undefined;
    if (parsed && componentSet.getSourceComponents(member).toArray().length === 0) {
      include.add({ type: member.type, fullName: parsed.name });
    }
  }
  if (include.size === 0) {
    return;
  }
  for (const component of ComponentSet.fromSource({ fsPaths, include, registry }).getSourceComponents()) {
    componentSet.addWithoutManifestEntry(component);
  }
};

/** Serves one file from memory and reads everything else from the tree it wraps. */
class OverlayTreeContainer extends TreeContainer {
  public constructor(
    private readonly base: TreeContainer,
    private readonly path: string,
    private readonly data: Buffer
  ) {
    super();
  }

  public exists(fsPath: SourcePath): boolean {
    return fsPath === this.path || this.base.exists(fsPath);
  }

  public isDirectory(fsPath: SourcePath): boolean {
    return fsPath !== this.path && this.base.isDirectory(fsPath);
  }

  public readDirectory(fsPath: SourcePath): string[] {
    return this.base.readDirectory(fsPath);
  }

  public readFile(fsPath: SourcePath): Promise<Buffer> {
    return fsPath === this.path ? Promise.resolve(this.data) : this.base.readFile(fsPath);
  }

  public readFileSync(fsPath: SourcePath): Buffer {
    return fsPath === this.path ? this.data : this.base.readFileSync(fsPath);
  }

  public stream(fsPath: SourcePath): Readable {
    return fsPath === this.path ? Readable.from([this.data]) : this.base.stream(fsPath);
  }
}

/**
 * A component outside every dataspace keeps one sidecar for all the dataspaces it was retrieved from,
 * and its `retrieveWith` mixes their peers. Deploying it for some of them sends a copy of the sidecar
 * listing only the peers in those dataspaces or outside every dataspace, so the org isn't asked for
 * peers the deploy doesn't include. The local file is left as is.
 */
const withSidecarFor = (
  component: SourceComponent,
  dataspaces: Set<string | undefined> | undefined
): SourceComponent => {
  // Not walked, or walked outside any dataspace too, so every peer is part of the deploy.
  if (!dataspaces || dataspaces.has(undefined)) {
    return component;
  }
  const path = getSidecarPath(component);
  const sidecar = readSidecar(component);
  if (!path || sidecar?.dataspaceName || !Array.isArray(sidecar?.retrieveWith)) {
    return component;
  }
  const retrieveWith = sidecar.retrieveWith.filter((ref) => !ref.dataspaceName || dataspaces.has(ref.dataspaceName));
  if (retrieveWith.length === sidecar.retrieveWith.length) {
    return component;
  }
  const data = Buffer.from(`${JSON.stringify({ ...sidecar, retrieveWith }, null, 2)}\n`);
  const { name, type, xml, parent, content, parentType } = component;
  const copy = new SourceComponent(
    { name, type, xml, parent, content, parentType },
    new OverlayTreeContainer(component.tree, path, data)
  );
  copy.replacements = component.replacements;
  return copy;
};

/**
 * Index every Data Cloud component in `full` by its sidecar type + componentName, the key space
 * `retrieveWith` references. A key can match several components, one per dataspace.
 */
const indexCandidates = (
  full: ComponentSet
): {
  findPeers: (ref: ComponentRef, dataspace: string | undefined) => SourceComponent[];
  getDataspace: (component: SourceComponent) => string | undefined;
} => {
  const byRef = new Map<string, SourceComponent[]>();
  const dataspaceOf = new Map<string, string | undefined>();
  for (const component of full.getSourceComponents()) {
    const sidecar = isD360(component) ? readSidecar(component) : undefined;
    if (sidecar?.componentType && sidecar.componentName) {
      const key = refKey(sidecar.componentType, sidecar.componentName);
      byRef.set(key, [...(byRef.get(key) ?? []), component]);
      dataspaceOf.set(memberKey(component), sidecar.dataspaceName);
    }
  }
  const getDataspace = (component: SourceComponent): string | undefined => dataspaceOf.get(memberKey(component));

  // A reference that names its dataspace matches a peer in that dataspace, and also one outside every
  // dataspace (a bare component serves every dataspace), but is skipped while walking another dataspace.
  // Otherwise, while walking a dataspace, only peers in it or outside every dataspace qualify; with no
  // dataspace to walk, all of them do.
  const findPeers = (ref: ComponentRef, dataspace: string | undefined): SourceComponent[] => {
    if (!ref.componentType || !ref.name || (dataspace && ref.dataspaceName && ref.dataspaceName !== dataspace)) {
      return [];
    }
    const candidates = byRef.get(refKey(ref.componentType, ref.name)) ?? [];
    if (ref.dataspaceName) {
      return candidates.filter((candidate) => [ref.dataspaceName, undefined].includes(getDataspace(candidate)));
    }
    return dataspace
      ? candidates.filter((candidate) => [dataspace, undefined].includes(getDataspace(candidate)))
      : candidates;
  };

  return { findPeers, getDataspace };
};

/**
 * Build the minimal deploy closure for Data Cloud components.
 *
 * The result is the requested components plus the transitive closure of their `retrieveWith` peers
 * (resolved via `retrieveWith` -> sidecar `componentType` + `componentName`), and nothing else. A peer
 * named with a dataspace is pulled from that dataspace. Otherwise a peer that exists in several
 * dataspaces is pulled from the requester's dataspace. A component outside any
 * dataspace pulls peers from the dataspaces it was requested for, or from all of them when requested
 * by its bare name. Other requested components pass through unchanged, so this is safe to call on any set.
 *
 * @param full A ComponentSet with every candidate component (the whole project); only its Data Cloud members are indexed for lookup.
 * @param requested The components the user asked to deploy.
 * @param registry Optional RegistryAccess to seed the resulting ComponentSet with (defaults to a fresh one).
 * @returns A new ComponentSet containing the requested components plus their retrieveWith closure.
 * Only the requested components get package.xml entries; the closure peers are sent as files.
 */
export const expandD360ComponentSet = (
  full: ComponentSet,
  requested: ComponentSet,
  registry?: RegistryAccess
): ComponentSet => {
  const { findPeers, getDataspace } = indexCandidates(full);

  // Members are collected first and added once the walk is done, since how a component outside every
  // dataspace is sent depends on all the dataspaces it was walked in.
  const members = new Map<string, { component: SourceComponent; inManifest: boolean }>();
  const qualifiedNames: MetadataComponent[] = [];
  const walkedIn = new Map<string, Set<string | undefined>>();
  const worklist: Array<{ component: SourceComponent; dataspace: string | undefined }> = [];
  // A component is walked once per dataspace, since it can be requested for several of them.
  const visit = (component: SourceComponent, dataspace: string | undefined): void => {
    const dataspaces = walkedIn.get(memberKey(component)) ?? new Set<string | undefined>();
    if (!dataspaces.has(dataspace)) {
      walkedIn.set(memberKey(component), dataspaces.add(dataspace));
      worklist.push({ component, dataspace });
    }
  };

  // Seed with everything the user requested; non-Data Cloud members are kept as-is.
  for (const component of requested.getSourceComponents()) {
    if (members.has(memberKey(component))) {
      continue;
    }
    const dataspaces =
      isD360(component) && !getDataspace(component) ? getRequestedDataspaces(requested, component) : [];
    // Requested as `<dataspace>.<name>`: keep that name in the manifest and walk only those dataspaces.
    members.set(memberKey(component), { component, inManifest: !dataspaces.length });
    for (const dataspace of dataspaces) {
      qualifiedNames.push({ type: component.type, fullName: toDataspaceQualifiedName(dataspace, component.fullName) });
      visit(component, dataspace);
    }
    if (!dataspaces.length && isD360(component)) {
      visit(component, getDataspace(component));
    }
  }

  // Walk retrieveWith transitively, pulling in only the referenced Data Cloud components.
  while (worklist.length) {
    const { component, dataspace } = worklist.pop()!;
    for (const ref of readSidecar(component)?.retrieveWith ?? []) {
      for (const peer of findPeers(ref, dataspace)) {
        if (!members.has(memberKey(peer))) {
          // Peers travel as files only. The Metadata API deploys them as part of the requested
          // component, so package.xml lists just what the user asked for, the same as on retrieve.
          members.set(memberKey(peer), { component: peer, inManifest: false });
        }
        // A peer outside every dataspace keeps walking in the dataspace it was reached from.
        visit(peer, getDataspace(peer) ?? dataspace);
      }
    }
  }

  const result = new ComponentSet([], registry);
  for (const [key, { component, inManifest }] of members) {
    const sent = withSidecarFor(component, walkedIn.get(key));
    if (inManifest) {
      result.add(sent);
    } else {
      result.addWithoutManifestEntry(sent);
    }
  }
  qualifiedNames.forEach((member) => result.add(member));

  return result;
};
