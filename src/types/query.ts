/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export type QueryResult = {
  size: number;
  totalSize: number;
  done: boolean;
  queryLocator: string;
  entityTypeName: string;
  records: QueryRecord[];
};

export type QueryRecord = {
  Id: string;
  Name?: string;
  NamespacePrefix?: string;
  Body?: string;
  Markup?: string;
  ApiVersion?: string;
  Status?: string;
  DefType?: string;
  Source?: string;
  FilePath?: string;
  AuraDefinitionBundle?: {
    ApiVersion: string;
    DeveloperName: string;
    NamespacePrefix: string;
  };
  LightningComponentBundle?: {
    DeveloperName: string;
    NamespacePrefix: string;
  };
};
