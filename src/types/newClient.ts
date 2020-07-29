/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SourceComponent } from '../metadata-registry';

// ------------------------------------------------
// API results reformatted for source development
// ------------------------------------------------

export type Id = string;

export type ComponentDeployment = {
  id?: string;
  component: SourceComponent;
  status: ComponentStatus;
  diagnostics: ComponentDiagnostic[];
};

export type ComponentDiagnostic = {
  lineNumber?: number;
  columnNumber?: number;
  message: string;
  type: 'Warning' | 'Error';
};

/**
 * Possible statuses of a component being deployed.
 */
export enum ComponentStatus {
  Created = 'Created',
  Changed = 'Changed',
  Unchanged = 'Unchanged',
  Deleted = 'Deleted',
  Failed = 'Failed'
}

interface SourceApiResult {
  success: boolean;
}

export interface SourceDeployResult extends SourceApiResult {
  id: Id;
  components?: ComponentDeployment[];
}

export interface MetadataSourceDeployResult extends SourceDeployResult {
  status: DeployStatus;
}

// export interface ToolingSourceDeployResult extends ApiDeployResult {
//   status: ContainerAsyncRequestState;
// }

// ------------------------------
// Metadata API result types
// ------------------------------

/**
 * Raw response returned from a checkDeployStatus call to the Metadata API
 */
export type DeployResult = {
  id: string;
  canceledBy?: string;
  canceledByName?: string;
  checkOnly: boolean;
  completedDate?: string;
  createdBy: string;
  createdByName: string;
  createdDate: string;
  details: DeployDetails;
  done: boolean;
  errorMessage?: string;
  errorStatusCode?: string;
  ignoreWarnings: boolean;
  lastModifiedDate: string;
  numberComponentErrors: number;
  numberComponentsDeployed: number;
  numberComponentsTotal: number;
  numberTestErrors: number;
  numberTestsCompleted: number;
  numberTestsTotal: number;
  runTestsEnabled: boolean;
  rollbackOnError: boolean;
  startDate?: string;
  stateDetail?: string;
  status: DeployStatus;
  success: boolean;
};

/**
 * Possible statuses of a metadata deploy operation.
 */
export enum DeployStatus {
  Pending = 'Pending',
  InProgress = 'InProgress',
  Succeeded = 'Succeeded',
  SucceededPartial = 'SucceededPartial',
  Failed = 'Failed',
  Canceling = 'Canceling',
  Canceled = 'Canceled'
}

export type DeployDetails = {
  componentFailures?: DeployMessage[];
  componentSuccesses?: DeployMessage[];
  // TODO: Add types for RetrieveResult and RunTestsResult
  // retrieveResult?:
  // runTestResult?:
};

// DeployMessage "booleans" are strings
type BooleanString = 'true' | 'false';

export type DeployMessage = {
  changed: BooleanString;
  columnNumber?: number;
  componentType?: string;
  created: BooleanString;
  createdDate: string;
  deleted: BooleanString;
  fileName: string;
  fullName: string;
  id?: string;
  lineNumber?: number;
  problem?: string;
  problemType?: 'Warning' | 'Error';
  success: BooleanString;
};

// ------------------------------
// Tooling API result types
// ------------------------------

// export type ContainerAsyncRequest = {
//   DeployDetails?: DeployDetails;
//   ErrorMsg?: string;
//   State?: ContainerAsyncRequestState;
// };

// export type ContainerAsyncRequestState =
//   | 'Queued'
//   | 'Invalidated'
//   | 'Completed'
//   | 'Failed'
//   | 'Error'
//   | 'Aborted';
