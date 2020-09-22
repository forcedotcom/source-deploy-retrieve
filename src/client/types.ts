/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Connection } from '@salesforce/core';
import { SourcePath } from '../common/types';
import { RegistryAccess, SourceComponent } from '../metadata-registry';

// ------------------------------------------------
// API results reformatted for source development
// ------------------------------------------------

export type RecordId = string;

export type ComponentDeployment = {
  id?: string;
  component: SourceComponent;
  status: ComponentStatus;
  diagnostics: ComponentDiagnostic[];
};

export type ComponentDiagnostic = {
  lineNumber?: number;
  columnNumber?: number;
  filePath?: SourcePath;
  message: string;
  type: 'Warning' | 'Error';
};

/**
 * Status of component during a deployment.
 */
export enum ComponentStatus {
  Created = 'Created',
  Changed = 'Changed',
  Unchanged = 'Unchanged',
  Deleted = 'Deleted',
  Failed = 'Failed',
}

interface SourceApiResult {
  success: boolean;
}

export interface SourceDeployResult extends SourceApiResult {
  id: RecordId;
  components?: ComponentDeployment[];
  status: DeployStatus | ToolingDeployStatus;
}

export interface SourceRetrieveResult extends SourceApiResult {
  id?: RecordId;
  components?: SourceComponent[];
  status: RetrieveStatus;
  message?: RetrieveMessage | string;
}

// ------------------------------------------------
// Metadata API result types
// ------------------------------------------------

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
  Canceled = 'Canceled',
}

export type DeployDetails = {
  componentFailures?: DeployMessage[];
  componentSuccesses?: DeployMessage[];
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
    members: string[];
    name: string;
  };
};

export enum RetrieveStatus {
  Pending = 'Pending',
  InProgress = 'InProgress',
  Succeeded = 'Succeeded',
  Failed = 'Failed',
}

export type RetrieveMessage = { fileName: string; problem: string };

/**
 * Raw response returned from a checkRetrieveStatus call to the Metadata API
 */
export type RetrieveResult = {
  done: boolean;
  fileProperties: {}[];
  id: string;
  messages: RetrieveMessage;
  status: RetrieveStatus;
  success: boolean;
  // this is a base64binary
  zipFile: string;
};

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
// Clients
// ------------------------------------------------

export interface DeployRetrieveClient {
  /**
   * Retrieve metadata components and wait for the result.
   *
   * @param options Specify `components`, `output` and other optionals
   */
  retrieve(options: RetrieveOptions): Promise<SourceRetrieveResult>;
  /**
   * Infer metadata components from source paths, retrieve them, and wait for the result.
   *
   * @param options Specify `paths`, `output` and other optionals
   */
  retrieveWithPaths(options: RetrievePathOptions): Promise<SourceRetrieveResult>;
  /**
   * Deploy metadata components and wait for result.
   *
   * @param filePath Paths to source files to deploy
   */
  deploy(components: SourceComponent | SourceComponent[]): Promise<SourceDeployResult>;
  /**
   * Infer metadata components from source path, deploy them, and wait for results.
   *
   * @param filePath Paths to source files to deploy
   */
  deployWithPaths(paths: SourcePath | SourcePath[]): Promise<SourceDeployResult>;
}

export abstract class BaseApi implements DeployRetrieveClient {
  protected connection: Connection;
  protected registry: RegistryAccess;

  constructor(connection: Connection, registry: RegistryAccess) {
    this.connection = connection;
    this.registry = registry;
  }

  /**
   * @param options Specify `paths`, `output` and other optionals
   */
  abstract retrieveWithPaths(options: RetrievePathOptions): Promise<SourceRetrieveResult>;

  abstract retrieve(options: RetrieveOptions): Promise<SourceRetrieveResult>;

  abstract deploy(components: SourceComponent | SourceComponent[]): Promise<SourceDeployResult>;

  abstract deployWithPaths(paths: SourcePath | SourcePath[]): Promise<SourceDeployResult>;
}

// ------------------------------------------------
// Client options
// ------------------------------------------------

type CommonOptions = {
  /**
   * Set the max number of seconds to wait for the operation.
   */
  wait?: number;
  namespace?: string;
};

type CommonRetrieveOptions = {
  /**
   * Whether or not the files should be automatically converted to
   * [source format](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_source_file_format.htm)
   */
  convert?: boolean;
  /**
   * Whether or not existing source files should be overwritten.
   */
  overwrite?: boolean;
  /**
   * The directory to retrieve the components to.
   */
  output?: SourcePath;
};

type CommonPathOptions = {
  /**
   * Source paths of the files to perform the operation on.
   */
  paths: SourcePath[];
};

export type RetrieveOptions = CommonOptions &
  CommonRetrieveOptions & { components: SourceComponent[] };

export type RetrievePathOptions = CommonOptions & CommonRetrieveOptions & CommonPathOptions;

export type ApiResult = {
  success: boolean;
  components: SourceComponent[];
  message?: string;
};

type WaitFlag = { wait?: number };
type NamespaceFlag = { namespace?: string };

export type MetadataApiDeployOptions = {
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
};

export type MetadataDeployOptions = WaitFlag & {
  apiOptions?: MetadataApiDeployOptions;
};

export type ToolingDeployOptions = NamespaceFlag;

export type DeployPathOptions = CommonOptions & CommonPathOptions;
