/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { dirname, join, sep } from 'path';
import { QueryResult, MetadataComponent } from '../types';
import {
  generateMetaXML,
  generateMetaXMLPath,
  trimMetaXmlSuffix
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
    case 'AuraDefinitionBundle':
      queryString =
        'Select Id, AuraDefinitionBundle.ApiVersion, AuraDefinitionBundle.DeveloperName, ';
      queryString += `AuraDefinitionBundle.NamespacePrefix, DefType, Source from AuraDefinition where AuraDefinitionBundle.DeveloperName = '${fullName}'`;
      break;
    case 'LightningComponentBundle':
      queryString =
        'Select Id, LightningComponentBundle.DeveloperName, LightningComponentBundle.NamespacePrefix, FilePath, Source from LightningComponentResource ';
      queryString += `where LightningComponentBundle.DeveloperName = '${fullName}'`;
      break;
    default:
      queryString = '';
  }

  return queryString;
}

function getAuraSourceName(
  componentPath: string,
  fileNamePrefix: string,
  defType: string
): string {
  const cmpParentName = join(dirname(componentPath), fileNamePrefix);

  switch (defType) {
    case 'APPLICATION':
      return `${cmpParentName}.app`;
    case 'COMPONENT':
      return `${cmpParentName}.cmp`;
    case 'DOCUMENTATION':
      return `${cmpParentName}.auradoc`;
    case 'STYLE':
      return `${cmpParentName}.css`;
    case 'EVENT':
      return `${cmpParentName}.evt`;
    case 'DESIGN':
      return `${cmpParentName}.design`;
    case 'SVG':
      return `${cmpParentName}.svg`;
    case 'CONTROLLER':
      return `${cmpParentName}Controller.js`;
    case 'HELPER':
      return `${cmpParentName}Helper.js`;
    case 'RENDERER':
      return `${cmpParentName}Renderer.js`;
    case 'TOKENS':
      return `${cmpParentName}.tokens`;
    case 'INTERFACE':
      return `${cmpParentName}.intf`;
    default:
      return '';
  }
}

export function queryToFileMap(
  queryResult: QueryResult,
  mdComponent: MetadataComponent,
  overrideOutputPath?: string
): Map<string, string> {
  const typeName = mdComponent.type.name;
  let apiVersion: string;
  let status: string;
  // If output is defined it overrides where the component will be stored
  const mdSourcePath = overrideOutputPath
    ? trimMetaXmlSuffix(overrideOutputPath)
    : mdComponent.sources[0];
  const saveFilesMap = new Map();
  switch (typeName) {
    case 'ApexClass':
    case 'ApexTrigger':
      status = queryResult.records[0].Status;
      apiVersion = queryResult.records[0].ApiVersion;
      saveFilesMap.set(mdSourcePath, queryResult.records[0].Body);
      break;
    case 'ApexComponent':
    case 'ApexPage':
      apiVersion = queryResult.records[0].ApiVersion;
      saveFilesMap.set(mdSourcePath, queryResult.records[0].Markup);
      break;
    case 'AuraDefinitionBundle':
      apiVersion = queryResult.records[0].AuraDefinitionBundle.ApiVersion;
      queryResult.records.forEach(item => {
        const cmpName = getAuraSourceName(
          mdSourcePath,
          mdComponent.fullName,
          item.DefType
        );
        saveFilesMap.set(cmpName, item.Source);
      });
      break;
    case 'LightningComponentBundle':
      const bundleParentPath = mdSourcePath.substring(
        0,
        mdSourcePath.lastIndexOf(`${sep}lwc`)
      );
      queryResult.records.forEach(item => {
        const cmpName = join(bundleParentPath, item.FilePath);
        saveFilesMap.set(cmpName, item.Source);
      });
      break;
    default:
  }

  // NOTE: LightningComponentBundle query results returns the -meta.xml file
  if (typeName !== 'LightningComponentBundle') {
    saveFilesMap.set(
      generateMetaXMLPath(mdSourcePath),
      generateMetaXML(typeName, apiVersion, status)
    );
  }

  return saveFilesMap;
}
