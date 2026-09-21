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
import { RegistryAccess } from '../registry/registryAccess';
import { SourceComponent } from '../resolve/sourceComponent';
import { ComponentSet } from './componentSet';

/**
 * Any Data Cloud dataspace-scoped component is stored as a PAIR of files: a payload `<name>.json`
 * carrying the component's definition, and a `<name>.meta.json` sidecar carrying
 * `{ componentType, componentName, dataspaceName, retrieveWith, dependsOn }`. This module is
 * type-agnostic — it works off the sidecar convention alone, so it covers every dataspace-scoped
 * type without per-type logic.
 *
 * The sidecar declares TWO distinct relationship lists, and they mean different things.
 * `retrieveWith` is the set of components that travel together with this one as a single deployable
 * unit — the deploy closure that {@link expandDataspaceScopedComponentSet} walks. `dependsOn` is
 * informational metadata about what this component references (the components it points at) and is
 * NOT used to build the deploy closure.
 *
 * Both lists reference the target component's `componentName` — NOT the SDR fullName
 * (e.g. `<dataspace>.<name>`). Resolution therefore matches on each component's sidecar
 * `componentName`, which every dataspace-scoped type carries regardless of how its payload is shaped
 * (payload shapes vary by type — some are objects, some are bare arrays).
 *
 * This module is intentionally standalone: it does NOT modify `ComponentSet` or any deploy
 * machinery. A caller (the CLI plugin) resolves the full project into `full`, decides what the
 * user requested into `requested`, and calls {@link expandDataspaceScopedComponentSet} to obtain
 * the exact closure to deploy — the requested components plus every dataspace-scoped component in
 * their transitive `retrieveWith` set, and nothing else.
 */

/** The adapter strategy id shared by every dataspace-scoped type. */
const DATASPACE_SCOPED_ADAPTER = 'dataspaceScoped';

/** Filename suffix of the per-component metadata sidecar (`<name>.meta.json`). */
const METADATA_SIDECAR_SUFFIX = '.meta.json';

type ComponentRef = { componentType?: string; componentName?: string };

type ComponentSidecar = {
  componentType?: string;
  componentName?: string;
  dataspaceName?: string;
  /** Components that deploy together with this one as one unit — drives the deploy closure. */
  retrieveWith?: ComponentRef[];
  /** Informational: what this component references (e.g. source DMOs). Not used for the closure. */
  dependsOn?: ComponentRef[];
};

const isDataspaceScoped = (component: SourceComponent): boolean =>
  component.type.strategies?.adapter === DATASPACE_SCOPED_ADAPTER;

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

/** The component's own identity: the sidecar `componentName` (the key space that `retrieveWith` references). */
const getComponentName = (component: SourceComponent): string | undefined =>
  readJson<ComponentSidecar>(component, getSidecarPath(component))?.componentName;

/** The `componentName` values this component lists in its sidecar `retrieveWith` (its deploy-closure peers). */
const getRetrieveWithNames = (component: SourceComponent): string[] =>
  (readJson<ComponentSidecar>(component, getSidecarPath(component))?.retrieveWith ?? [])
    .map((entry) => entry.componentName)
    .filter((name): name is string => Boolean(name));

/**
 * Build the minimal deploy closure for dataspace-scoped components.
 *
 * The result is the requested components plus the transitive closure of their dataspace-scoped
 * `retrieveWith` peers (resolved via `retrieveWith` -> sidecar `componentName`), and nothing else.
 * Non-dataspace-scoped requested components pass through unchanged, so this is safe to call on any set.
 *
 * @param full A ComponentSet with every candidate component (the whole project); only its dataspace-scoped members are indexed for lookup.
 * @param requested The components the user asked to deploy.
 * @param registry Optional RegistryAccess to seed the resulting ComponentSet with (defaults to a fresh one).
 * @returns A new ComponentSet containing the requested components plus their dataspace-scoped retrieveWith closure.
 */
export const expandDataspaceScopedComponentSet = (
  full: ComponentSet,
  requested: ComponentSet,
  registry?: RegistryAccess
): ComponentSet => {
  // Index dataspace-scoped candidates by their sidecar componentName (the retrieveWith key space).
  const byComponentName = new Map<string, SourceComponent>();
  for (const component of full.getSourceComponents()) {
    if (isDataspaceScoped(component)) {
      const componentName = getComponentName(component);
      if (componentName) {
        byComponentName.set(componentName, component);
      }
    }
  }

  const result = new ComponentSet([], registry);
  const seen = new Set<SourceComponent>();
  const worklist: SourceComponent[] = [];

  // Seed with everything the user requested; non-dataspace-scoped members are kept as-is.
  for (const component of requested.getSourceComponents()) {
    if (!seen.has(component)) {
      seen.add(component);
      result.add(component);
      if (isDataspaceScoped(component)) {
        worklist.push(component);
      }
    }
  }

  // Walk retrieveWith transitively, pulling in only the referenced dataspace-scoped components.
  while (worklist.length) {
    const component = worklist.pop()!;
    for (const peerName of getRetrieveWithNames(component)) {
      const peer = byComponentName.get(peerName);
      if (peer && !seen.has(peer)) {
        seen.add(peer);
        result.add(peer);
        worklist.push(peer);
      }
    }
  }

  return result;
};
