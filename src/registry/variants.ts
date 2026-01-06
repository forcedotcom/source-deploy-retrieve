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
import { Logger, SfProject, SfProjectJson, Lifecycle, SfError } from '@salesforce/core';
import { MetadataRegistry } from './types';
// The static import of json file should never be changed,
// other read methods might make esbuild fail to bundle the json file
import * as registryData from './metadataRegistry.json';
import { presetMap } from './presets/presetMap';

type ProjectVariants = {
  registryCustomizations?: MetadataRegistry;
  presets?: MetadataRegistry[];
  projectDir?: never;
};

export type RegistryLoadInput =
  | {
      /** The project directory to look at sfdx-project.json file
       * will default to the current working directory
       * if no project file is found, the standard registry will be returned without modifications
       */
      projectDir?: string;
      registryCustomizations?: never;
      presets?: never;
    }
  | ProjectVariants;

/** combine the standard registration with any overrides specific in the sfdx-project.json */
export const getEffectiveRegistry = (input?: RegistryLoadInput): Readonly<MetadataRegistry> =>
  removeEmptyStrings(
    firstLevelMerge(
      registryData as MetadataRegistry,
      mergeVariants(
        input?.presets?.length ?? input?.registryCustomizations ? input : getProjectVariants(input?.projectDir)
      )
    )
  );

/** read the project to get additional registry customizations and sourceBehaviorOptions */
const getProjectVariants = (projectDir?: string): ProjectVariants => {
  const logger = Logger.childFromRoot('variants:getProjectVariants');
  const projJson = maybeGetProject(projectDir);
  if (!projJson) {
    logger.debug('no project found, using standard registry');
    // there might not be a project at all and that's ok
    return {};
  }

  // there might not be any customizations in a project, so we default to the emptyRegistry
  const registryCustomizations = projJson.get<MetadataRegistry>('registryCustomizations') ?? emptyRegistry;
  const presets = [
    ...new Set([
      // TODO: deprecated, remove this
      ...(projJson.get<string[]>('registryPresets') ?? []),
      ...(projJson.get<string[]>('sourceBehaviorOptions') ?? []),
    ]),
  ];
  return logProjectVariants(
    {
      registryCustomizations,
      presets: presets.map(loadPreset),
    },
    projJson.getPath()
  );
};

const mergeVariants = ({ registryCustomizations = emptyRegistry, presets }: ProjectVariants): MetadataRegistry => {
  const registryFromPresets = [...(presets ?? []), registryCustomizations].reduce<MetadataRegistry>(
    (prev, curr) => firstLevelMerge(prev, curr),
    emptyRegistry
  );

  return firstLevelMerge(registryFromPresets, registryCustomizations);
};

const maybeGetProject = (projectDir?: string): SfProjectJson | undefined => {
  try {
    return SfProject.getInstance(projectDir ?? process.cwd()).getSfProjectJson();
  } catch (e) {
    return undefined;
  }
};

const loadPreset = (preset: string): MetadataRegistry => {
  const matchedPreset = presetMap.get(preset);
  if (matchedPreset) {
    return matchedPreset;
  }
  throw SfError.create({
    message: `Failed to load preset "${preset}"`,
    name: 'InvalidPreset',
    actions: [
      `Use a valid preset.  Currently available presets are: [${[...presetMap.keys()].join(', ')}]`,
      'Updating your CLI may be required to get newer presets',
    ],
  });
};

const emptyRegistry = {
  types: {},
  childTypes: {},
  suffixes: {},
  strictDirectoryNames: {},
} as const satisfies MetadataRegistry;

/** merge the children of the top-level properties (ex: types, suffixes, etc) on 2 registries */
export const firstLevelMerge = (original: MetadataRegistry, overrides: MetadataRegistry): MetadataRegistry => ({
  types: { ...original.types, ...(overrides.types ?? {}) },
  childTypes: { ...original.childTypes, ...(overrides.childTypes ?? {}) },
  suffixes: { ...original.suffixes, ...(overrides.suffixes ?? {}) },
  strictDirectoryNames: {
    ...original.strictDirectoryNames,
    ...(overrides.strictDirectoryNames ?? {}),
  },
});

const removeEmptyStrings = (reg: MetadataRegistry): MetadataRegistry => ({
  types: reg.types,
  childTypes: removeEmptyString(reg.childTypes),
  suffixes: removeEmptyString(reg.suffixes),
  strictDirectoryNames: removeEmptyString(reg.strictDirectoryNames),
});

// presets can remove an entry by setting it to an empty string ex: { "childTypes": { "foo": "" } }
const removeEmptyString = (obj: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== ''));

// returns the projectVariants passed in.  Side effects: logger and telemetry only
const logProjectVariants = (variants: ProjectVariants, projectDir: string): ProjectVariants => {
  const customizationTypes = Object.keys(variants.registryCustomizations?.types ?? {});
  const logger = Logger.childFromRoot('variants:logProjectVariants');
  if (customizationTypes.length) {
    logger.debug(`found registryCustomizations for types [${customizationTypes.join(',')}] in ${projectDir}`);
  }
  if (variants.presets?.length) {
    logger.debug(`using sourceBehaviorOptions [${variants.presets.join(',')}] in ${projectDir}`);
  }
  if (variants?.presets?.length ?? customizationTypes.length) {
    void Lifecycle.getInstance().emitTelemetry({
      library: 'SDR',
      eventName: 'RegistryVariants',
      presetCount: variants.presets?.length ?? 0,
      presets: variants.presets?.join(','),
      customizationsCount: customizationTypes.length,
      customizationsTypes: customizationTypes.join(','),
    });
  } else {
    logger.debug(`no registryCustomizations or sourceBehaviorOptions found in ${projectDir}`);
  }
  return variants;
};
