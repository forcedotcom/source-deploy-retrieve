/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import { MetadataComponent, SourcePath } from './common';

type CommonOptions = {
  /**
   * Set the max number of seconds to wait for the operation.
   */
  wait?: number;
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

export type RetrievePathOptions = CommonOptions &
  CommonRetrieveOptions &
  CommonPathOptions;

export type ApiResult = {
  success: boolean;
  components: MetadataComponent[];
  message?: string;
};

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
}

export abstract class BaseApi implements DeployRetrieveClient {
  protected connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * @param options Specify `paths`, `output` and other optionals
   */
  abstract retrieveWithPaths(options: RetrievePathOptions): Promise<ApiResult>;

  abstract retrieve(options: RetrieveOptions): Promise<ApiResult>;
}
