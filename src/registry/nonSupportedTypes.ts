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
  'SLACK',
  'SUSTAINABILITYAPP',
  'SERVICECATALOG',
  'INSURANCECALCULATIONUSER',
  'HEALTHCLOUDUSER',
  'TERRITORYMANAGEMENT',
  'ASSOCIATIONENGINE',
  'CUSTOMERDATAPLATFORM',
  'AIREPLYRECOMMENDATIONS',
  'DOCGEN',
  'SERVICECLOUDVOICEPARTNERTELEPHONY:1',
  'PSAPPLICATIONUSAGECREDITS',
  'INDUSTRIESMFGACCOUNTFORECAST',
];

export const settings = [
  'botSettings', // have not successfully described this because of licensing errors when deploying settings
];
export const metadataTypes = [
  'EmailTemplateFolder', // not a real addressable type (parent of email template)

  // things that don't show up in describe so far
  'PicklistValue', // only existed in v37, so it's hard to describe!
  'FieldRestrictionRule', // not in describe for devorg.  ScratchDef might need feature 'EMPLOYEEEXPERIENCE' but it doesn't say that
  'AppointmentSchedulingPolicy', // not in describe?
  'WorkflowFlowAction', // not in describe

  // two children of GlobalValueSet
  'CustomValue',
  'StandardValue',
];

export const hasUnsupportedFeatures = (type: CoverageObjectType): boolean => {
  if (!type.scratchDefinitions?.developer) {
    return true;
  }
  const scratchDef = JSON.parse(type.scratchDefinitions.developer) as {
    features?: string[];
    settings?: {
      [key: string]: any;
    };
  };
  if (
    scratchDef.features &&
    scratchDef.features.length > 0 &&
    features.some((feature) => scratchDef.features.includes(feature))
  ) {
    return true;
  }
  if (scratchDef.settings && settings.some((setting) => scratchDef.settings[setting])) {
    return true;
  }
  return false;
};
