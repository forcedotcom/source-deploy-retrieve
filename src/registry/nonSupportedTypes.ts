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
  'SERVICECATALOG',
  'DYNAMICATTRIBUTES',
  'CONTRACTMGMT',
  'CUSTOMIZABLENAMEDCREDENTIALS',
  'INDUSTRIESMFGPROGRAMPILOT',
  'HEALTHCLOUDHPIBETA',
  'MANAGETIMELINE',
  'HEALTHCLOUDBETA',
  'UNIFIEDHEALTHSCORING',
  'EINSTEINDOCREADER',
  'ACCOUNTINGSUBLEDGERACCESS',
  'INSURANCECALCULATIONUSER',
  'SCFUELTYPEPILOTFEATURE',
  'B2CEREPRICINGKILLSWITCH',
  'USERACCESSPOLICIESFORPILOTVISIBILITY',
  'BOTBLOCKS',
  'INDUSTRIESINTERACTIONCALCULATION',
  'BUSINESSRULESENGINE',
  'FUNDRAISING',
  'PARDOTADVANCED', // org:create throws a C-9999 when this is not excluded
];

export const settings = [
  'botSettings', // have not successfully deployed this because of licensing errors when deploying settings
];
export const metadataTypes = [
  // things that don't show up in describe so far
  'PicklistValue', // only existed in v37, so it's hard to describe!
  // two children of GlobalValueSet
  'CustomValue',
  'StandardValue',

  // the following are not describable based on their features/settings, see git blame for last time checked
  'DiscoveryStory',
  'EmployeeDataSyncProfile',
  'RelatedRecordAssocCriteria',
  'ScoreRange',
  'WorkflowFlowAction',

  // the metadata coverage report seems to be missing a setting:
  // A scratch org was created with username test-o87upqyaagax@example.com, but the settings failed to deploy due to: enableInsights
  'ReferencedDashboard',
  'WaveAnalyticAssetCollection',

  // spins up fine with feature B2CLOYALTYMANAGEMENT, not in describe
  'ExpressionSetObjectAlias',

  // requires no features, but not in describe
  'ExternalDataSrcDescriptor',

  // spun up with COMMONPRM, not in describe
  'PortalDelegablePermissionSet',

  // spun up with CUSTOMERDATAPLATFORM, not in describe
  'ExternalDataTranField',
  'ExternalDataTranObject',

  // spun up with HIGHSCALEORDERS, not in describe
  'RegisteredExternalService',

  // spun up org with ASSESSMENTS, not in describe
  'AssessmentConfiguration',

  // spun up org with INDUSTRIESEPCNEXTPILOT, not in describe
  'ProductAttrDisplayConfig',
  'ProductSpecificationRecType',
  'ProductSpecificationType',

  // spun up org with ASSOCIATIONENGINE, not in describe
  'RecAlrtDataSrcExpSetDef',
  'RecordAlertTemplate',

  // B2CLOYALTYMANAGEMENTPLUS, not in describe
  'ServiceProcess',

  // does not show up in describe, but requires no features
  'ProcessFlowMigration',
];

export const hasUnsupportedFeatures = (type: CoverageObjectType): boolean => {
  if (!type.orgShapes?.developer) {
    return true;
  }

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
