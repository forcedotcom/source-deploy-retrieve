/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SfProject } from '@salesforce/core';
import { JsonMap } from '@salesforce/ts-types';
import { deepFreeze } from '../utils';
import * as registryData from './metadataRegistry.json';
import { MetadataRegistry } from './types';

/** Read the project to get additional registry customizations */
const loadRawRegistryInfo = async ({ projectDir }: { projectDir?: string } = {}): Promise<MetadataRegistry> => {
  try {
    const proj = await SfProject.resolve(projectDir);
    const projJson = (await proj.resolveProjectConfig()) as JsonMap & CustomRegistry;
    // there might not be any customizations in a project
    return projJson.registry?.raw ?? emptyRegistry;
  } catch (e) {
    // there might not be a project at all
    return emptyRegistry;
  }
};

const emptyRegistry = {
  types: {},
  childTypes: {},
  suffixes: {},
  strictDirectoryNames: {},
} satisfies MetadataRegistry;

const firstLevelMerge = (original: MetadataRegistry, additional: MetadataRegistry): MetadataRegistry => ({
  types: { ...original.types, ...additional.types },
  childTypes: { ...original.childTypes, ...additional.childTypes },
  suffixes: { ...original.suffixes, ...additional.suffixes },
  strictDirectoryNames: { ...original.strictDirectoryNames, ...additional.strictDirectoryNames },
});

/**
 * The default metadata registry.
 */
export const registry = deepFreeze<MetadataRegistry>(
  firstLevelMerge(registryData as MetadataRegistry, await loadRawRegistryInfo())
);

// TODO: this type should live somewhere else and be part of the sfdx-project schema
type CustomRegistry = {
  registry?: {
    raw?: MetadataRegistry;
  };
};
