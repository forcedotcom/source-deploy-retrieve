/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import { ToolingApi } from './toolingApi';
/**
 * Transfer SFDX source to and from a Salesforce org.
 */
export class SourceClient {
  public readonly connection: Connection;
  /**
   * Perform operations using the tooling api
   */
  public readonly tooling: ToolingApi;

  constructor(connection: Connection) {
    this.connection = connection;
    this.tooling = new ToolingApi(connection);
  }
}
