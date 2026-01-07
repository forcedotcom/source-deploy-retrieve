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
