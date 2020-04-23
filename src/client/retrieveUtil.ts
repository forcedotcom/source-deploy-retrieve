/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { QueryResult, MetadataComponent } from '../types';
import {
  generateMetaXML,
  generateMetaXMLPath,
  cleanSourcePath
} from '../utils';

export function buildQuery(mdComponent: MetadataComponent): string {
  let queryString = '';
  const typeName = mdComponent.type.name;
  const fullName = mdComponent.fullName;

  switch (typeName) {
    case 'ApexClass':
    case 'ApexTrigger':
      queryString = `Select Id, ApiVersion, Body, Name, NamespacePrefix, Status from ${typeName} where Name = '${fullName}'`;
      break;
    case 'ApexComponent':
    case 'ApexPage':
      queryString = `Select Id, ApiVersion, Name, NamespacePrefix, Markup from ${typeName} where Name = '${fullName}'`;
      break;
    default:
      queryString = '';
  }

  return queryString;
}

export function queryToFileMap(
  queryResult: QueryResult,
  mdComponent: MetadataComponent,
  overrideOutputPath?: string
): Map<string, string> {
  const typeName = mdComponent.type.name;
  const apiVersion = queryResult.records[0].ApiVersion;
  let source: string[] = [];
  let status: string;

  switch (typeName) {
    case 'ApexClass':
    case 'ApexTrigger':
      status = queryResult.records[0].Status;
      source = [queryResult.records[0].Body];
      break;
    case 'ApexComponent':
    case 'ApexPage':
      source = [queryResult.records[0].Markup];
      break;
    default:
      source = [];
  }

  // If output is defined it overrides where the component will be stored
  const mdSourcePath = overrideOutputPath
    ? cleanSourcePath(overrideOutputPath)
    : mdComponent.sources[0];

  const saveFilesMap = new Map();
  saveFilesMap.set(mdSourcePath, source[0]);
  saveFilesMap.set(
    generateMetaXMLPath(mdSourcePath),
    generateMetaXML(typeName, apiVersion, status)
  );
  return saveFilesMap;
}
