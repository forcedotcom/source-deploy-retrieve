/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import { MetadataComponent, SourcePath } from './common';
import { RegistryAccess } from '../metadata-registry';
import { DeployOptions as JSForceDeployOptions } from 'jsforce';

type CommonOptions = JSForceDeployOptions & {
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
  CommonRetrieveOptions & { components: MetadataComponent[] };

export type RetrievePathOptions = CommonOptions & CommonRetrieveOptions & CommonPathOptions;

export type ApiResult = {
  success: boolean;
  components: MetadataComponent[];
  message?: string;
};

export type DeployOptions = CommonOptions & { components: MetadataComponent[] };

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
/**
 * Infers the source format structure of a metadata component when given a file path.
 */
export interface SourceAdapter {
  getComponent(fsPath: SourcePath): MetadataComponent;
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
  /* Deploy metadata components and wait for result.
   *
   * @param filePath Paths to source files to deploy
   */
  deploy(options: DeployOptions): Promise<DeployResult>;
  /* Infer metadata components from source path, deploy them, and wait for results.
   *
   * @param filePath Paths to source files to deploy
   */
  deployWithPaths(options: DeployPathOptions): Promise<DeployResult>;
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

  abstract deploy(options: DeployOptions): Promise<DeployResult>;

  abstract deployWithPaths(options: DeployPathOptions): Promise<DeployResult>;
}
