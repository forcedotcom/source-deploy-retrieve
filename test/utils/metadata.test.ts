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

import * as path from 'node:path';
import { expect } from 'chai';
import { generateMetaXML, generateMetaXMLPath, trimMetaXmlSuffix } from '../../src/utils';

describe('Metadata Utils', () => {
  let metaXMLFile = '<?xml version="1.0" encoding="UTF-8"?>\n';
  metaXMLFile += '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">\n';
  metaXMLFile += '\t<apiVersion>32.0</apiVersion>\n';
  metaXMLFile += '\t<status>Active</status>\n';
  metaXMLFile += '</ApexClass>';

  it('should generate a meta-xml blob', () => {
    const metaXMLBlob = generateMetaXML('ApexClass', '32', 'Active');
    expect(metaXMLBlob).to.equals(metaXMLFile);
  });

  it('should generate a meta-xml blob without status', () => {
    let expectedMetaXMLFile = '<?xml version="1.0" encoding="UTF-8"?>\n';
    expectedMetaXMLFile += '<ApexComponent xmlns="http://soap.sforce.com/2006/04/metadata">\n';
    expectedMetaXMLFile += '\t<apiVersion>43.0</apiVersion>\n';
    expectedMetaXMLFile += '</ApexComponent>';
    const metaXMLBlob = generateMetaXML('ApexComponent', '43', '');
    expect(metaXMLBlob).to.equals(expectedMetaXMLFile);
  });

  it('should generate a meta-xml path', () => {
    const genericFilePath = generateMetaXMLPath(path.join('some', 'file', 'path.cls'));
    expect(genericFilePath).to.equals(path.join('some', 'file', 'path.cls-meta.xml'));
  });

  it('should generate correct meta-xml path when meta-xml path is provided', () => {
    const genericFilePath = generateMetaXMLPath(path.join('some', 'file', 'path.cls-meta.xml'));
    expect(genericFilePath).to.equals(path.join('some', 'file', 'path.cls-meta.xml'));
  });

  it('should return filepath without meta-xml ', () => {
    const genericFilePath = trimMetaXmlSuffix(path.join('some', 'file', 'path.cls-meta.xml'));
    expect(genericFilePath).to.equals(path.join('some', 'file', 'path.cls'));
  });

  it('should return filepath without meta-xml when path without meta-xml is provided', () => {
    const genericFilePath = trimMetaXmlSuffix(path.join('some', 'file', 'path.cls'));
    expect(genericFilePath).to.equals(path.join('some', 'file', 'path.cls'));
  });
});
