/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Logger, SfProject, SfProjectJson, Lifecycle } from '@salesforce/core';
import { deepFreeze } from '../utils/collections';
import { MetadataRegistry } from './types';
import * as registryData from './metadataRegistry.json';
import decomposeCustomLabelsBeta from './presets/decomposeCustomLabelsBeta.json';
import decomposePermissionSetBeta from './presets/decomposePermissionSetBeta.json';
import decomposeSharingRulesBeta from './presets/decomposeSharingRulesBeta.json';
import decomposeWorkflowBeta from './presets/decomposeWorkflowBeta.json';

export type RegistryLoadInput = {
  /** The project directory to look at sfdx-project.json file
   * will default to the current working directory
   * if no project file is found, the standard registry will be returned without modifications
   */
  projectDir?: string;
};

/** combine the standard registration with any overrides specific in the sfdx-project.json */
export const getEffectiveRegistry = (input?: RegistryLoadInput): MetadataRegistry =>
  deepFreeze(firstLevelMerge(registryData as MetadataRegistry, loadVariants(input)));

const presetsJsonMap: Map<string, string> = new Map();

/** read the project to get additional registry customizations and sourceBehaviorOptions */
const loadVariants = ({ projectDir }: RegistryLoadInput = {}): MetadataRegistry => {
  const logger = Logger.childFromRoot('variants');
  const projJson = maybeGetProject(projectDir);
  if (!projJson) {
    logger.debug('no project found, using standard registry');
    // there might not be a project at all and that's ok
    return emptyRegistry;
  }

  // there might not be any customizations in a project, so we default to the emptyRegistry
  const customizations = projJson.get<MetadataRegistry>('registryCustomizations') ?? emptyRegistry;
  const sourceBehaviorOptions = [
    ...new Set([
      // TODO: deprecated, remove this
      ...(projJson.get<string[]>('registryPresets') ?? []),
      ...(projJson.get<string[]>('sourceBehaviorOptions') ?? []),
    ]),
  ];
  if (Object.keys(customizations.types).length > 0) {
    logger.debug(
      `found registryCustomizations for types [${Object.keys(customizations.types).join(',')}] in ${projJson.getPath()}`
    );
  }
  if (sourceBehaviorOptions.length > 0) {
    logger.debug(`using sourceBehaviorOptions [${sourceBehaviorOptions.join(',')}] in ${projJson.getPath()}`);
    loadPresetJson();
  }
  const registryFromPresets = sourceBehaviorOptions.reduce<MetadataRegistry>(
    (prev, curr) => firstLevelMerge(prev, loadPreset(curr)),
    emptyRegistry
  );
  if (sourceBehaviorOptions.length > 0 || Object.keys(customizations.types).length > 0) {
    void Lifecycle.getInstance().emitTelemetry({
      library: 'SDR',
      eventName: 'RegistryVariants',
      presetCount: sourceBehaviorOptions.length,
      presets: sourceBehaviorOptions.join(','),
      customizationsCount: Object.keys(customizations.types).length,
      customizationsTypes: Object.keys(customizations.types).join(','),
    });
  }
  return firstLevelMerge(registryFromPresets, customizations);
};

const maybeGetProject = (projectDir?: string): SfProjectJson | undefined => {
  try {
    return SfProject.getInstance(projectDir ?? process.cwd()).getSfProjectJson();
  } catch (e) {
    return undefined;
  }
};

const loadPresetJson = (): void => {
  presetsJsonMap.set('decomposeCustomLabelsBeta', JSON.stringify(decomposeCustomLabelsBeta));
  presetsJsonMap.set('decomposePermissionSetBeta', JSON.stringify(decomposePermissionSetBeta));
  presetsJsonMap.set('decomposeSharingRulesBeta', JSON.stringify(decomposeSharingRulesBeta));
  presetsJsonMap.set('decomposeWorkflowBeta', JSON.stringify(decomposeWorkflowBeta));
};

const loadPreset = (preset: string): MetadataRegistry => {
  try {
    const rawPreset = presetsJsonMap.get(preset);
    return JSON.parse(rawPreset as string) as MetadataRegistry;
  } catch (e) {
    throw new Error(`Failed to load preset ${preset}. The value is invalid.`);
  }
};

const emptyRegistry = {
  types: {},
  childTypes: {},
  suffixes: {},
  strictDirectoryNames: {},
} satisfies MetadataRegistry;

/** merge the children of the top-level properties (ex: types, suffixes, etc) on 2 registries */
export const firstLevelMerge = (original: MetadataRegistry, overrides: MetadataRegistry): MetadataRegistry => ({
  types: { ...original.types, ...(overrides.types ?? {}) },
  childTypes: { ...original.childTypes, ...(overrides.childTypes ?? {}) },
  suffixes: { ...original.suffixes, ...(overrides.suffixes ?? {}) },
  strictDirectoryNames: { ...original.strictDirectoryNames, ...(overrides.strictDirectoryNames ?? {}) },
});
