/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CoverageObjectType } from './types';

/**
 * when checking for completeness or building registries
 * this is the list of features that are not available,
 * typically because the devhub doesn't support them, so we can't use metadataDescribe
 *
 * */
export const features = [];

export const settings = [];

export const metadataTypes = [
  // things that don't show up in describe so far
  'PicklistValue', // only existed in v37, so it's hard to describe!
  // two children of GlobalValueSet
  'CustomValue',
  'StandardValue',
];

export const hasUnsupportedFeatures = (type: CoverageObjectType): boolean => {
  if (
    type.orgShapes.developer.features?.length &&
    features.some((feature) => type.orgShapes?.developer.features?.includes(feature))
  ) {
    return true;
  }
  return (
    Boolean(type.orgShapes?.developer.settings) &&
    settings.some((setting) => type.orgShapes?.developer.settings?.[setting])
  );
};
