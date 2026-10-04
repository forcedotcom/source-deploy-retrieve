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
 * Data Cloud dataspace-scoped components (CalculatedInsight, DataModelObject) carry an explicit
 * dependency declaration in their on-disk envelope, e.g.
 * `{ "entityPayload": { "name": "ciTest" }, "dependsOn": [{ "DataModelObject": "account__dlm" }] }`.
 *
 * A `dependsOn` entry is `{ "<TypeName>": "<referenced entityPayload.name>" }`. The referenced
 * value is the target component's `entityPayload.name` (e.g. `account__dlm`) — NOT the SDR
 * fullName (e.g. `default.account`). Dependency resolution therefore matches on the envelope's
 * `entityPayload.name`, read from each component's content file.
 *
 * This module is intentionally standalone: it does NOT modify `ComponentSet` or any deploy
 * machinery. A caller (the CLI plugin) resolves the full project into `full`, decides what the
 * user requested into `requested`, and calls {@link expandDataspaceScopedComponentSet} to obtain
 * the exact closure to deploy — the requested components plus every dataspace-scoped component they
 * transitively depend on, and nothing else.
 */

/** The adapter strategy id that marks a dataspace-scoped type (CalculatedInsight, DataModelObject). */
const DATASPACE_SCOPED_ADAPTER = 'dataspaceScoped';

type DataspaceScopedEnvelope = {
  entityPayload?: { name?: string };
  dependsOn?: Array<Record<string, string>>;
};

const isDataspaceScoped = (component: SourceComponent): boolean =>
  component.type.strategies?.adapter === DATASPACE_SCOPED_ADAPTER;

/** Parse a dataspace-scoped component's envelope from its content file. Returns undefined if unreadable. */
const readEnvelope = (component: SourceComponent): DataspaceScopedEnvelope | undefined => {
  if (!component.content) {
    return undefined;
  }
  try {
    return JSON.parse(component.tree.readFileSync(component.content).toString()) as DataspaceScopedEnvelope;
  } catch {
    return undefined;
  }
};

/** The referenced `entityPayload.name` values a component declares in its `dependsOn`. */
const getDependencyNames = (component: SourceComponent): string[] =>
  (readEnvelope(component)?.dependsOn ?? []).flatMap((entry) => Object.values(entry)).filter(Boolean);

/**
 * Build the minimal deploy closure for dataspace-scoped components.
 *
 * The result is the requested components plus the transitive closure of their dataspace-scoped
 * dependencies (resolved via `dependsOn` -> `entityPayload.name`), and nothing else.
 * Non-dataspace-scoped requested components pass through unchanged, so this is safe to call on any set.
 *
 * @param full A ComponentSet with every candidate component (the whole project); only its dataspace-scoped members are indexed for lookup.
 * @param requested The components the user asked to deploy.
 * @param registry Optional RegistryAccess to seed the resulting ComponentSet with (defaults to a fresh one).
 * @returns A new ComponentSet containing the requested components plus their dataspace-scoped dependency closure.
 */
export const expandDataspaceScopedComponentSet = (
  full: ComponentSet,
  requested: ComponentSet,
  registry?: RegistryAccess
): ComponentSet => {
  // Index dataspace-scoped candidates by their envelope entityPayload.name (the dependsOn key space).
  const byPayloadName = new Map<string, SourceComponent>();
  for (const component of full.getSourceComponents()) {
    if (isDataspaceScoped(component)) {
      const payloadName = readEnvelope(component)?.entityPayload?.name;
      if (payloadName) {
        byPayloadName.set(payloadName, component);
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

  // Walk dependsOn transitively, pulling in only the referenced dataspace-scoped components.
  while (worklist.length) {
    const component = worklist.pop()!;
    for (const depName of getDependencyNames(component)) {
      const dep = byPayloadName.get(depName);
      if (dep && !seen.has(dep)) {
        seen.add(dep);
        result.add(dep);
        worklist.push(dep);
      }
    }
  }

  return result;
};
