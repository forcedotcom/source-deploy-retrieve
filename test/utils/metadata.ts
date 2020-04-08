/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { generateMetaXML, generateMetaXMLPath } from '../../src/utils';
import * as path from 'path';
import { expect } from 'chai';

describe('Metadata Utils', () => {
  let metaXMLFile = '<?xml version="1.0" encoding="UTF-8"?>\n';
  metaXMLFile +=
    '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">\n';
  metaXMLFile += '\t<apiVersion>32.0</apiVersion>\n';
  metaXMLFile += '\t<status>Active</status>\n';
  metaXMLFile += '</ApexClass>';

  it('should generate a meta-xml blob', () => {
    const metaXMLBlob = generateMetaXML('ApexClass', '32', 'Active');
    expect(metaXMLBlob).to.equals(metaXMLFile);
  });

  it('should generate a meta-xml path', () => {
    const genericFilePath = generateMetaXMLPath(
      path.join('some', 'file', 'path.cls')
    );
    expect(genericFilePath).to.equals(
      path.join('some', 'file', 'path.cls-meta.xml')
    );
  });
});
