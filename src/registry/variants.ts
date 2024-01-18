/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Logger, SfProject } from '@salesforce/core';
import { deepFreeze } from '../utils/collections';
import { MetadataRegistry } from './types';
import * as registryData from './metadataRegistry.json';

export type RegistryLoadInput = {
  /** The project directory to look at sfdx-project.json file
   * will default to the current working directory
   * if no project file is found, the standard registry will be returned without modifications
   */
  // TODO: this might be a string instead of an object if no other props are needed
  projectDir?: string;
};

/** combine the standard registration with any overrides specific in the sfdx-project.json */
export const getEffectiveRegistry = (input?: RegistryLoadInput): MetadataRegistry =>
  deepFreeze(firstLevelMerge(registryData as MetadataRegistry, loadRawRegistryInfo(input)));

/** read the project to get additional registry customizations */
const loadRawRegistryInfo = ({ projectDir }: RegistryLoadInput = {}): MetadataRegistry => {
  const logger = Logger.childFromRoot('variants');
  try {
    const projJson = SfProject.getInstance(projectDir ?? process.cwd()).getSfProjectJson();

    // there might not be any customizations in a project, so we default to the emptyRegistry
    // TODO: return the presets combined with the customizations
    const customizations = projJson.get<MetadataRegistry>('registryCustomizations');
    if (customizations) {
      logger.debug(
        `found registryCustomizations for types [${Object.keys(customizations.types).join(
          ','
        )}] in ${projJson.getPath()}`
      );
    }
    return projJson.get<MetadataRegistry>('registryCustomizations') ?? emptyRegistry;
  } catch (e) {
    logger.debug('no project found, using standard registry');
    // there might not be a project at all
    return emptyRegistry;
  }
};

// TODO: this type should maybe live somewhere else and be part of the sfdx-project schema
// but we don't want circular dependency from sfdx-core to SDR
// type CustomRegistry = {
//   registryCustomizations: MetadataRegistry;
//   registryPresets: string[];
// };

const emptyRegistry = {
  types: {},
  childTypes: {},
  suffixes: {},
  strictDirectoryNames: {},
} satisfies MetadataRegistry;

/** merge the children of the top-level properties (ex: types, suffixes, etc) on 2 registries */
const firstLevelMerge = (original: MetadataRegistry, overrides: MetadataRegistry): MetadataRegistry => ({
  types: { ...original.types, ...(overrides.types ?? {}) },
  childTypes: { ...original.childTypes, ...(overrides.childTypes ?? {}) },
  suffixes: { ...original.suffixes, ...(overrides.suffixes ?? {}) },
  strictDirectoryNames: { ...original.strictDirectoryNames, ...(overrides.strictDirectoryNames ?? {}) },
});
