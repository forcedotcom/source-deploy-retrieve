/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ComponentSet } from '../collections';
import { PackageTypeMembers } from '../collections/types';
import { MetadataComponent, SourcePath } from '../common/types';
import { SourceComponent } from '../metadata-registry';

// ------------------------------------------------
// API results reformatted for source development
// ------------------------------------------------

export type RecordId = string;

export enum ComponentStatus {
  Created = 'Created',
  Changed = 'Changed',
  Unchanged = 'Unchanged',
  Deleted = 'Deleted',
  Failed = 'Failed',
}

export type ComponentDeployment = {
  id?: string;
  component: SourceComponent;
  status: ComponentStatus;
  diagnostics: ComponentDiagnostic[];
};

export type ComponentRetrieval = {
  component: SourceComponent;
  status?: RequestStatus;
  diagnostics?: ComponentDiagnostic;
};

export type ComponentDiagnostic = {
  lineNumber?: number;
  columnNumber?: number;
  filePath?: SourcePath;
  error: string;
  problemType: 'Warning' | 'Error';
};

interface FileResponseBase {
  fullName: string;
  type: string;
  filePath?: string;
}

interface FileResponseSuccess extends FileResponseBase {
  state: Exclude<ComponentStatus, ComponentStatus.Failed>;
}

interface FileResponseFailure extends FileResponseBase {
  state: ComponentStatus.Failed;
  lineNumber?: number;
  columnNumber?: number;
  error: string;
  problemType: 'Warning' | 'Error';
}

export type FileResponse = FileResponseSuccess | FileResponseFailure;

export interface MetadataTransferResult {
  response: MetadataRequestStatus;
  components: ComponentSet;
  getFileResponses(): FileResponse[];
}

export interface SourceApiResult {
  success: boolean;
}

export interface SourceDeployResult extends SourceApiResult {
  id: RecordId;
  components?: ComponentDeployment[];
  status: RequestStatus | ToolingDeployStatus;
}

export enum RequestStatus {
  Pending = 'Pending',
  InProgress = 'InProgress',
  Succeeded = 'Succeeded',
  SucceededPartial = 'SucceededPartial',
  Failed = 'Failed',
  Canceling = 'Canceling',
  Canceled = 'Canceled',
}

export interface MetadataRequestStatus {
  id: string;
  status: RequestStatus;
  success: boolean;
  done: boolean;
}

export type RetrieveFailure = {
  component?: MetadataComponent;
  message: string;
};

export type RetrieveSuccess = {
  component: SourceComponent;
  properties?: FileProperties;
};

export interface SourceRetrieveResult extends SourceApiResult {
  id?: RecordId;
  successes: RetrieveSuccess[];
  failures: RetrieveFailure[];
  status: RequestStatus;
}

// ------------------------------------------------
// Metadata API result types
// ------------------------------------------------

/**
 * Raw response returned from a checkDeployStatus call to the Metadata API
 */
export interface MetadataApiDeployStatus extends MetadataRequestStatus {
  canceledBy?: string;
  canceledByName?: string;
  checkOnly: boolean;
  completedDate?: string;
  createdBy: string;
  createdByName: string;
  createdDate: string;
  details: DeployDetails;
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
}

export type DeployDetails = {
  componentFailures?: DeployMessage | DeployMessage[];
  componentSuccesses?: DeployMessage | DeployMessage[];
  // TODO: Add types for RetrieveResult and RunTestsResult
  // retrieveResult?:
  // runTestResult?:
};

type BooleanString = 'true' | 'false' | true | false;

export type DeployMessage = {
  changed: BooleanString;
  columnNumber?: string;
  componentType?: string;
  created: BooleanString;
  createdDate: string;
  deleted: BooleanString;
  fileName: string;
  fullName: string;
  id?: string;
  lineNumber?: string;
  problem?: string;
  problemType?: 'Warning' | 'Error';
  success: BooleanString;
};

export type RetrieveRequest = {
  apiVersion: string;
  packageNames?: string[];
  singlePackage?: boolean;
  specificFiles?: string[];
  unpackaged: {
    types: PackageTypeMembers[];
  };
};

export type RetrieveMessage = { fileName: string; problem: string };

enum ManageableState {
  Beta = 'beta',
  Deleted = 'deleted',
  Deprecated = 'deprecated',
  DeprecatedEditable = 'deprecatedEditable',
  Installed = 'installed',
  InstalledEditable = 'installedEditable',
  Released = 'released',
  Unmanaged = 'unmanaged',
}

export type FileProperties = {
  createdById: string;
  createdByName: string;
  createdDate: string;
  fileName: string;
  fullName: string;
  id: string;
  lastModifiedById: string;
  lastModifiedByName: string;
  lastModifiedDate: string;
  manageableState?: ManageableState;
  namespacePrefix?: string;
  type: string;
};

/**
 * Raw response returned from a checkRetrieveStatus call to the Metadata API
 */
export interface MetadataApiRetrieveStatus {
  done: boolean;
  fileProperties: FileProperties | FileProperties[];
  id: string;
  status: RequestStatus;
  success: boolean;
  messages?: RetrieveMessage[] | RetrieveMessage;
  /** `base64` encoded string */
  zipFile: string;
}

// ------------------------------------------------
// Tooling API result types
// ------------------------------------------------

export type ContainerAsyncRequest = {
  Id: RecordId;
  DeployDetails?: DeployDetails;
  ErrorMsg?: string;
  State?: ToolingDeployStatus;
};

export const enum ToolingDeployStatus {
  // ContainerAsyncRequest states
  Queued = 'Queued',
  Invalidated = 'Invalidated',
  Error = 'Error',
  Aborted = 'Aborted',
  // Shared
  Completed = 'Completed',
  Failed = 'Failed',
  // unique to bundle requests
  CompletedPartial = 'CompletedPartial',
}

export type QueryResult = {
  size: number;
  totalSize: number;
  done: boolean;
  queryLocator: string;
  entityTypeName: string;
  records: ApexRecord[] | AuraRecord[] | LWCRecord[] | VFRecord[];
};

export type ApexRecord = {
  Id: string;
  Name: string;
  NamespacePrefix: string;
  Body: string;
  ApiVersion: string;
  Status: string;
};

export type VFRecord = {
  Id: string;
  Name: string;
  NamespacePrefix: string;
  Markup: string;
  ApiVersion: string;
};

export type AuraRecord = {
  Id: string;
  DefType: string;
  Source: string;
  AuraDefinitionBundle: {
    ApiVersion: string;
    DeveloperName: string;
    NamespacePrefix: string;
  };
};

export type LWCRecord = {
  Id: string;
  FilePath: string;
  Source: string;
  LightningComponentBundle: {
    DeveloperName: string;
    NamespacePrefix: string;
  };
};

// ------------------------------------------------
// Client options
// ------------------------------------------------

export interface RetrieveOptions {
  /**
   * The directory to retrieve components to. If `merge: true`, components are only
   * retrieved to `output` if there wasn't a component to merge with.
   */
  output: SourcePath;
  /**
   * Whether or not to merge and replace input components with the retrieved versions
   */
  merge?: boolean;
  /**
   * A list of package names to retrieve
   */
  packageNames?: string[];
}

export interface MetadataApiDeployOptions {
  allowMissingFiles?: boolean;
  autoUpdatePackage?: boolean;
  checkOnly?: boolean;
  ignoreWarnings?: boolean;
  performRetrieve?: boolean;
  purgeOnDelete?: boolean;
  rollbackOnError?: boolean;
  runAllTests?: boolean;
  runTests?: string[];
  singlePackage?: boolean;
  restDeploy?: boolean;
}
