/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { firstLevelMerge } from '../../src/registry/variants';
import { MetadataRegistry } from '../../src/registry/types';
import { registry as defaultRegistry } from '../../src/registry/registry';

const presetFolder = path.join(__dirname, '../../src/registry/presets');
type RegistryIterator = {
  name: string;
  registry: MetadataRegistry;
};

const registriesFromPresets = fs
  .readdirSync(presetFolder, { withFileTypes: true })
  .filter((file) => file.name.endsWith('.json'))
  // we don't want to test the original preset since it conflicts with the CustomLabelsBeta2
  .filter((file) => !file.name.endsWith('CustomLabelsBeta.json'))
  .map((file) => ({
    name: file.name,
    registry: JSON.parse(fs.readFileSync(path.join(file.parentPath, file.name), 'utf-8')) as MetadataRegistry,
  })) /*
  decomposedPermissionSetBeta2 has an invalid registry configured.
  this is because multiple children will map to the .objectSettings suffix, and currently, the registry only supports 1:1 suffix mapping
  TODO: W-10113922
   */
  .filter((preset) => !preset.name.endsWith('decomposePermissionSetBeta2.json'));

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
