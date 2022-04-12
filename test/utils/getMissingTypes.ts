/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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
      !hasUnsupportedFeatures(value) && // we don't support these types
      !value.orgShapes.developer.missingSettings // can't be done because settings are missing
  );
  const registryTypeNames = Object.values(registry.types).flatMap((regType) => [
    regType.name,
    ...(regType.children ? Object.values(regType.children.types).map((child) => child.name) : []),
  ]);
  const missingTypes = metadataApiTypesFromCoverage.filter(([key]) => !registryTypeNames.includes(key));
  return missingTypes;
};
