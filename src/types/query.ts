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
