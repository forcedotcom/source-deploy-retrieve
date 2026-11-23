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
import { Logger } from '@salesforce/core/logger';
import { RegistryAccess } from '../registry/registryAccess';
import { MetadataType } from '../registry/types';
import { MetadataResolver } from '../resolve/metadataResolver';
import { SourceComponent } from '../resolve/sourceComponent';
import { TreeContainer } from '../resolve/treeContainers';
import { MetadataComponent } from '../resolve/types';
import { SourcePath } from '../common/types';
import {
  getD360ContentPath,
  getD360Dataspaces,
  getD360Location,
  METADATA_SIDECAR_SUFFIX,
  parseDataspaceQualifiedName,
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

const isD360Type = (type: MetadataType): boolean => type.strategies?.adapter === D360_ADAPTER;

const isD360 = (component: MetadataComponent): boolean => isD360Type(component.type);

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
    // Requested by its bare name too: it is already in the set, with the manifest entry that name needs.
    if (!componentSet.has(component)) {
      componentSet.addWithoutManifestEntry(component);
    }
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

/** The dataspace a Data Cloud component is stored in, from its path. Undefined outside every dataspace. */
const getDataspace = (component: SourceComponent): string | undefined =>
  component.content ? getD360Location(component.content, component.type.directoryName)?.dataspace : undefined;

/**
 * Finds the components a `retrieveWith` entry points at, by path. The layout under a `d360` folder is
 * fixed, so an entry's type, name and dataspace give the path of each candidate directly, and only those
 * paths are checked. Peers are looked up in the same `d360` folder as the component that names them.
 *
 * A candidate is a peer when its sidecar names the same type and component as the entry, so a file
 * without a matching sidecar is never pulled in.
 */
const createPeerFinder = (
  registry: RegistryAccess
): ((from: SourceComponent, ref: ComponentRef, dataspace: string | undefined) => SourceComponent[]) => {
  const types = new Map<string, MetadataType | undefined>();
  const getType = (name: string): MetadataType | undefined => {
    if (!types.has(name)) {
      types.set(
        name,
        registry.findType((type) => type.name === name && isD360Type(type))
      );
    }
    return types.get(name);
  };

  const resolved = new Map<SourcePath, SourceComponent | undefined>();
  const resolveAt = (tree: TreeContainer, path: SourcePath): SourceComponent | undefined => {
    if (!resolved.has(path)) {
      const found = tree.exists(path)
        ? new MetadataResolver(registry, tree).getComponentsFromPath(path).find(isD360)
        : undefined;
      resolved.set(path, found);
    }
    return resolved.get(path);
  };

  // A reference that names its dataspace matches a peer in that dataspace, and also one outside every
  // dataspace (a bare component serves every dataspace), but is skipped while walking another dataspace.
  // Otherwise, while walking a dataspace, only peers in it or outside every dataspace qualify; with no
  // dataspace to walk, all of them do.
  return (from, ref, dataspace) => {
    const { componentType, name, dataspaceName } = ref;
    const type = componentType ? getType(componentType) : undefined;
    const location = from.content ? getD360Location(from.content, from.type.directoryName) : undefined;
    if (!type || !name || !location || (dataspace && dataspaceName && dataspaceName !== dataspace)) {
      return [];
    }
    const dataspaces = dataspaceName ?? dataspace;
    return [undefined, ...(dataspaces ? [dataspaces] : getD360Dataspaces(from.tree, location.root))]
      .map((ds) => resolveAt(from.tree, getD360ContentPath(location.root, type, name, ds)))
      .filter((peer): peer is SourceComponent => {
        const sidecar = peer ? readSidecar(peer) : undefined;
        return sidecar?.componentType === componentType && sidecar?.componentName === name;
      });
  };
};

/** A component of the closure, and whether it was requested and needs a manifest entry of its own. */
type Member = { component: SourceComponent; inManifest: boolean; requested: boolean };

/** Writes the walked members into the set, each with the sidecar for the dataspaces it was walked in. */
const addMembers = (
  set: ComponentSet,
  members: Map<string, Member>,
  walkedIn: Map<string, Set<string | undefined>>
): void => {
  const peers = [...members.keys()].filter((key) => !members.get(key)?.requested);
  if (peers.length) {
    Logger.childFromRoot('expandD360ComponentSet').debug(`Adding Data Cloud deploy peers: ${peers.join(', ')}`);
  }
  for (const [key, { component, inManifest, requested }] of members) {
    const sent = withSidecarFor(component, walkedIn.get(key));
    // A requested component is already in the set; it is only replaced when its sidecar is narrowed.
    if (requested && sent === component) {
      continue;
    }
    if (inManifest) {
      set.add(sent);
    } else {
      set.addWithoutManifestEntry(sent);
    }
  }
};

/**
 * Add the deploy closure of the Data Cloud components in a set to that set.
 *
 * The closure is the transitive closure of the requested components' `retrieveWith` peers (resolved via
 * `retrieveWith` -> sidecar `componentType` + `componentName`). A peer named with a dataspace is pulled
 * from that dataspace. Otherwise a peer that exists in several dataspaces is pulled from the requester's
 * dataspace. A component outside any dataspace pulls peers from the dataspaces it was requested for, or
 * from all of them when requested by its bare name.
 *
 * The set is changed in place, so everything else about it is kept: other components, components marked
 * for delete, wildcards, and its API versions. Components marked for delete are not walked, and a peer
 * already in the set is left as it is. Expanding a set that was already expanded adds nothing.
 *
 * Peers are found by path, in the same `d360` folder as the component that names them, so the project
 * is not resolved as a whole.
 *
 * @param requested The components to deploy. The closure peers are added to it.
 * @param registry RegistryAccess used to resolve the peers.
 * @returns The same set, with the closure peers added. They are sent as files, without package.xml entries.
 */
export const expandD360ComponentSet = (requested: ComponentSet, registry: RegistryAccess): ComponentSet => {
  const findPeers = createPeerFinder(registry);
  const inSet = new Set(requested.getSourceComponents().toArray().map(memberKey));

  // Members are collected first and written once the walk is done, since how a component outside every
  // dataspace is sent depends on all the dataspaces it was walked in.
  const members = new Map<string, Member>();
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

  // Seed with the Data Cloud components to deploy.
  for (const component of requested.getSourceComponents()) {
    if (!isD360(component) || component.isMarkedForDelete() || members.has(memberKey(component))) {
      continue;
    }
    const dataspaces = getDataspace(component) ? [] : getRequestedDataspaces(requested, component);
    // Without a manifest entry and not requested for a dataspace, it is a peer an earlier expansion added.
    // Its closure is already in the set, and walking it again could reach dataspaces it wasn't reached in.
    if (!dataspaces.length && requested.isWithoutManifestEntry(component)) {
      continue;
    }
    // Requested as `<dataspace>.<name>`: that name is in the manifest, so walk only those dataspaces.
    members.set(memberKey(component), { component, inManifest: !dataspaces.length, requested: true });
    dataspaces.forEach((dataspace) => visit(component, dataspace));
    if (!dataspaces.length) {
      visit(component, getDataspace(component));
    }
  }

  // Walk retrieveWith transitively, pulling in only the referenced Data Cloud components.
  while (worklist.length) {
    const { component, dataspace } = worklist.pop()!;
    for (const ref of readSidecar(component)?.retrieveWith ?? []) {
      for (const peer of findPeers(component, ref, dataspace)) {
        const key = memberKey(peer);
        // A peer the set already has (to deploy or to delete) keeps what the caller asked for it.
        if (inSet.has(key) && !members.has(key)) {
          continue;
        }
        if (!members.has(key)) {
          // Peers travel as files only. The Metadata API deploys them as part of the requested
          // component, so package.xml lists just what the user asked for, the same as on retrieve.
          members.set(key, { component: peer, inManifest: false, requested: false });
        }
        // A peer outside every dataspace keeps walking in the dataspace it was reached from.
        visit(peer, getDataspace(peer) ?? dataspace);
      }
    }
  }

  addMembers(requested, members, walkedIn);

  return requested;
};
