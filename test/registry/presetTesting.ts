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
