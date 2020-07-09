/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import { SourcePath, SourceComponent } from './common';
import { RegistryAccess } from '../metadata-registry';

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

export type DeployResult = {
  State: DeployStatusEnum;
  ErrorMsg: string | null;
  isDeleted: boolean;
  DeployDetails: DeployDetails | null;
  outboundFiles?: string[];
  metadataFile: string;
};

export type DeployDetails = {
  componentFailures: SourceResult[];
  componentSuccesses: SourceResult[];
};

export type SourceResult = {
  columnNumber?: number;
  lineNumber?: number;
  problem?: string;
  problemType?: string;
  fileName?: string;
  fullName?: string;
  componentType: string;
  success?: boolean;
  changed: boolean;
  created: boolean;
  deleted: boolean;
};

export enum DeployStatusEnum {
  Completed = 'Completed',
  Queued = 'Queued',
  Error = 'Error',
  Failed = 'Failed'
}

export interface DeployRetrieveClient {
  /**
   * Retrieve metadata components and wait for the result.
   *
   * @param options Specify `components`, `output` and other optionals
   */
  retrieve(options: RetrieveOptions): Promise<ApiResult>;
  /**
   * Infer metadata components from source paths, retrieve them, and wait for the result.
   *
   * @param options Specify `paths`, `output` and other optionals
   */
  retrieveWithPaths(options: RetrievePathOptions): Promise<ApiResult>;
  /**
   * Deploy metadata components and wait for result.
   *
   * @param filePath Paths to source files to deploy
   */
  deploy(components: MetadataComponent | MetadataComponent[]): Promise<DeployResult>;
  /**
   * Infer metadata components from source path, deploy them, and wait for results.
   *
   * @param filePath Paths to source files to deploy
   */
  deployWithPaths(paths: SourcePath | SourcePath[]): Promise<DeployResult>;
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
  abstract retrieveWithPaths(options: RetrievePathOptions): Promise<ApiResult>;

  abstract retrieve(options: RetrieveOptions): Promise<ApiResult>;

  abstract deploy(components: MetadataComponent | MetadataComponent[]): Promise<DeployResult>;

  abstract deployWithPaths(paths: SourcePath | SourcePath[]): Promise<DeployResult>;
}
