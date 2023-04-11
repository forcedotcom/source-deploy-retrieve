/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ComponentSet } from '../collections';
import { PackageTypeMembers } from '../collections/types';
import { SourcePath } from '../common/types';
import { MetadataComponent, SourceComponent } from '../resolve';
import { SfdxFileFormat } from '../convert';

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

export interface FileResponseSuccess extends FileResponseBase {
  state: Exclude<ComponentStatus, ComponentStatus.Failed>;
}

export interface FileResponseFailure extends FileResponseBase {
  state: ComponentStatus.Failed;
  lineNumber?: number;
  columnNumber?: number;
  error: string;
  problemType: 'Warning' | 'Error';
}

export type FileResponse = FileResponseSuccess | FileResponseFailure;
export interface MetadataTransferResult {
  response: MetadataRequestStatus;
  components?: ComponentSet;
  getFileResponses(): FileResponse[];
}

export interface AsyncResult {
  id: RecordId;
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
  // TODO: Add types for RetrieveResult
  // retrieveResult?:
  runTestResult?: RunTestResult;
};

export interface RunTestResult {
  codeCoverage?: CodeCoverage[] | CodeCoverage;
  codeCoverageWarnings?: CodeCoverageWarnings[] | CodeCoverageWarnings;
  failures?: Failures[] | Failures;
  numFailures: string;
  numTestsRun: string;
  successes?: Successes[] | Successes;
  totalTime: string;
}

export interface CodeCoverage {
  id: string;
  locationsNotCovered?: LocationsNotCovered[] | LocationsNotCovered;
  name: string;
  numLocations: string;
  numLocationsNotCovered: string;
  type: string;
}

export interface LocationsNotCovered {
  column: string;
  line: string;
  numExecutions: string;
  time: string;
}

export interface CodeCoverageWarnings {
  id: string;
  message: string;
  namespace: string;
}

export interface Failures {
  id: string;
  message: string;
  methodName: string;
  name: string;
  packageName: string;
  stackTrace: string;
  time: string;
  type: string;
}

export interface Successes {
  id: string;
  methodName: string;
  name: string;
  time: string;
}

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
  unpackaged?: {
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
// Client options
// ------------------------------------------------

export interface PackageOption {
  /**
   * The name of the package to retrieve.
   */
  name: string;
  /**
   * The directory where the retrieved package source should be
   * converted. If this is not specified the directory will
   * default to `<process.cwd()>/PackageOption.name`.
   */
  outputDir?: SourcePath;
}

export type PackageOptions = string[] | PackageOption[];

export interface RetrieveExtractOptions {
  /**
   * Top most directory within the retrieved zip file.
   * E.g., `unpackaged` for unpackaged source, or the name of the
   * package for retrieved package source.
   */
  zipTreeLocation: string;
  /**
   * The directory where the retrieved source should be converted.
   * This is `RetrieveOptions.output` for unpackaged source, and
   * `PackageOption.outputDir` for packaged source.
   */
  outputDir: SourcePath;
}

export interface RetrieveOptions {
  /**
   * The directory to retrieve components to. If `merge: true`, components are only
   * retrieved to `output` if there wasn't a component to merge with.
   */
  output: SourcePath;
  /**
   * Whether or not to merge and replace input components with the retrieved versions.
   */
  merge?: boolean;
  /**
   * A list of package names to retrieve, or package names and their retrieval locations.
   */
  packageOptions?: PackageOptions;
  /**
   * The file format desired for the retrieved files.
   */
  format?: SfdxFileFormat;
  /**
   * Specifies whether only a single package is being retrieved (true) or not (false).
   * If false, then more than one package is being retrieved.
   */
  singlePackage?: boolean;
  /**
   * The name of the retrieved zip file containing the source from the org. Only applies when `format: metadata`.
   */
  zipFileName?: string;
  /**
   * Specifies whether to unzip the retrieved zip file. Only applies when `format: metadata`.
   */
  unzip?: boolean;
  /**
   * Specifies whether to suppress the <Pre|Post><Retrieve> events
   */
  suppressEvents?: boolean;
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
  testLevel?: 'NoTestRun' | 'RunSpecifiedTests' | 'RunLocalTests' | 'RunAllTestsInOrg';
  /**
   * Set to true to use the REST API for deploying.
   */
  rest?: boolean;
}

export interface StdValueSetRecord {
  Id: string;
  MasterLabel: string;
  Metadata: { standardValue: Array<Record<string, unknown>> };
}

export interface ListMetadataQuery {
  type: string;
  folder?: string;
}

export interface DeployVersionData {
  apiVersion: string;
  manifestVersion: string | undefined;
  webService: 'SOAP' | 'REST';
}

export interface RetrieveVersionData {
  apiVersion: string;
  manifestVersion: string;
}
