/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Connection } from '@salesforce/core';
import { ToolingApi } from './toolingApi';
import { MetadataResolver } from '../metadata-registry';
import { MetadataApi } from './metadataApi';

/**
 * Transfer SFDX source to and from a Salesforce org.
 */
export class SourceClient {
  public readonly connection: Connection;
  /**
   * Perform operations using the tooling api.
   */
  public readonly tooling: ToolingApi;
  public readonly metadata: MetadataApi;

  constructor(connection: Connection, resolver = new MetadataResolver()) {
    this.connection = connection;
    this.tooling = new ToolingApi(connection, resolver);
    this.metadata = new MetadataApi(connection, resolver);
  }
}
