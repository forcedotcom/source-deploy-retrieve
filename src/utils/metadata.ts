/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { CustomLabel } from '@jsforce/jsforce-node/lib/api/metadata';
import { SfError } from '@salesforce/core/sfError';
import { XMLParser } from 'fast-xml-parser';
import { META_XML_SUFFIX, XML_COMMENT_PROP_NAME } from '../common/constants';

export const parser = new XMLParser({
  // include tag attributes and don't parse text node as number
  ignoreAttributes: false,
  parseTagValue: false,
  parseAttributeValue: false,
  cdataPropName: '__cdata',
  ignoreDeclaration: true,
  numberParseOptions: { leadingZeros: false, hex: false },
  commentPropName: XML_COMMENT_PROP_NAME,
});

export function generateMetaXML(typeName: string, apiVersion: string, status: string): string {
  let templateResult = '<?xml version="1.0" encoding="UTF-8"?>\n';
  templateResult += `<${typeName} xmlns="http://soap.sforce.com/2006/04/metadata">\n`;
  templateResult += `\t<apiVersion>${apiVersion}.0</apiVersion>\n`;
  if (status) {
    templateResult += `\t<status>${status}</status>\n`;
  }
  templateResult += `</${typeName}>`;
  return templateResult;
}

export function generateMetaXMLPath(sourcePath: string): string {
  return sourcePath.endsWith(META_XML_SUFFIX) ? sourcePath : `${sourcePath}${META_XML_SUFFIX}`;
}

export function trimMetaXmlSuffix(sourcePath: string): string {
  return sourcePath.endsWith(META_XML_SUFFIX) ? sourcePath.replace(META_XML_SUFFIX, '') : sourcePath;
}

export const customLabelHasFullName = (label: CustomLabel): label is CustomLabel & { fullName: string } => {
  if (label.fullName === undefined) {
    throw SfError.create({ message: 'Label does not have a fullName', data: label });
  }
  return true;
};
