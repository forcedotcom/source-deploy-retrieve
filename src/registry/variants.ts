/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Logger, SfProject, SfProjectJson, Lifecycle, SfError } from '@salesforce/core';
import { deepFreeze } from '../utils/collections';
import { MetadataRegistry } from './types';
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
export const getEffectiveRegistry = (input?: RegistryLoadInput): MetadataRegistry =>
  deepFreeze(
    removeEmptyStrings(
      firstLevelMerge(
        registryData as MetadataRegistry,
        mergeVariants(
          input?.presets?.length ?? input?.registryCustomizations ? input : getProjectVariants(input?.projectDir)
        )
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
