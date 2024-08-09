/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { CustomLabel } from '@jsforce/jsforce-node/lib/api/metadata';
import { SfError } from '@salesforce/core';
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
