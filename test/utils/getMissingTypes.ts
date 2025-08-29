/*
 * Copyright 2025, Salesforce, Inc.
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
import { CoverageObjectType, CoverageObject } from '../../src/registry/types';
import { hasUnsupportedFeatures, metadataTypes } from '../../src/registry/nonSupportedTypes';
import { MetadataRegistry } from '../../src';

export const getMissingTypes = (
  metadataCoverage: CoverageObject,
  registry: MetadataRegistry
): Array<[string, CoverageObjectType]> => {
  const metadataApiTypesFromCoverage = Object.entries(metadataCoverage.types).filter(
    ([key, value]) =>
      value.channels.metadataApi.exposed && // if it's not in the mdapi, we don't worry about the registry
      !metadataTypes.includes(key) && // types we should ignore, see the imported file for explanations
      !key.endsWith('Settings') && // individual settings shouldn't be in the registry
      !hasUnsupportedFeatures(value) // we don't support these types
  );
  const registryTypeNames = Object.values(registry.types).flatMap((regType) => [
    regType.name,
    ...(regType.children ? Object.values(regType.children.types).map((child) => child.name) : []),
  ]);
  const missingTypes = metadataApiTypesFromCoverage.filter(([key]) => !registryTypeNames.includes(key));
  return missingTypes;
};
