/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { META_XML_SUFFIX } from '../common';

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
  return sourcePath.endsWith(META_XML_SUFFIX)
    ? sourcePath.replace(META_XML_SUFFIX, '')
    : sourcePath;
}
