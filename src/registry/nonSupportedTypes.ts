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
export const features = [
  // ERROR running force:org:create: * is not a valid Features value.
  // 'SUSTAINABILITYAPP',
  'SERVICECATALOG',
  'EXPLAINABILITY',
  'DYNAMICATTRIBUTES',
  'CONTRACTMGMT',
  'CUSTOMIZABLENAMEDCREDENTIALS',
  'INDUSTRIESMFGPROGRAMPILOT',
  'HEALTHCLOUDHPIBETA',
  'MANAGETIMELINE',
  'HEALTHCLOUDBETA',
];

export const settings = [
  'botSettings', // have not successfully deployed this because of licensing errors when deploying settings
];
export const metadataTypes = [
  // things that don't show up in describe so far
  'PicklistValue', // only existed in v37, so it's hard to describe!
  'AppointmentAssignmentPolicy', // not in describe?
  'WorkflowFlowAction', // not in describe
  'AdvAcctForecastDimSource', // not in describe
  'CareLimitType', // not in describe
  'RelatedRecordAssocCriteria', // not in describe
  'OmniInteractionAccessConfig', // not in describe
  // two children of GlobalValueSet
  'CustomValue',
  'StandardValue',
];

export const hasUnsupportedFeatures = (type: CoverageObjectType): boolean => {
  if (!type.orgShapes?.developer) {
    return true;
  }

  if (
    type.orgShapes.developer.features?.length &&
    features.some((feature) => type.orgShapes?.developer.features.includes(feature))
  ) {
    return true;
  }
  return type.orgShapes?.developer.settings && settings.some((setting) => type.orgShapes?.developer.settings[setting]);
};
