/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { firstLevelMerge } from '../../src/registry/variants';
import { MetadataRegistry } from '../../src';
import { registry as defaultRegistry } from '../../src/registry/registry';
import * as decomposeWorkflow from '../../src/registry/presets/decomposeWorkflow.json';
import * as decomposeSharingRules from '../../src/registry/presets/decomposeSharingRules.json';
import * as decomposePS from '../../src/registry/presets/decomposePermissionSet.json';

type RegistryIterator = {
  name: string;
  registry: MetadataRegistry;
};

const registriesFromPresets: RegistryIterator[] = [
  {
    name: 'decomposeWorkflow',
    registry: decomposeWorkflow as MetadataRegistry,
  },
  {
    name: 'decomposeSharingRules',
    registry: decomposeSharingRules as MetadataRegistry,
  },
  {
    name: 'decomposePermissionSet',
    registry: decomposePS as MetadataRegistry,
  },
];

const allMerged = registriesFromPresets.reduce<MetadataRegistry>(
  (acc, { registry }) => firstLevelMerge(acc, registry),
  defaultRegistry
);

export const presets: RegistryIterator[] = [
  {
    name: 'default',
    registry: defaultRegistry as MetadataRegistry,
  },
]
  .concat(registriesFromPresets)
  // each registry can merge successfully with the default registry
  .concat(
    registriesFromPresets.map((preset) => ({
      name: `defaultRegistry merged with ${preset.name}`,
      registry: firstLevelMerge(defaultRegistry, preset.registry),
    }))
  )
  .concat([{ name: 'all presets combined', registry: allMerged }]);
