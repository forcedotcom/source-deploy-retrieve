/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection } from '@salesforce/core';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { assert, expect } from 'chai';
import * as fs from 'fs';
import { createSandbox, SinonSandbox } from 'sinon';
import { ContainerDeploy } from '../../../src/client/deployStrategies';
import { nls } from '../../../src/i18n';

const $$ = testSetup();

describe('Base Deploy Strategy', () => {
  let simpleMetaXMLString = '<?xml version="1.0" encoding="UTF-8"?>';
  simpleMetaXMLString += '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">';
  simpleMetaXMLString += '    <apiVersion>32.0</apiVersion>';
  simpleMetaXMLString += '    <status>Active</status>';
  simpleMetaXMLString += '</ApexClass>';
  const testData = new MockTestOrgData();
  let mockConnection: Connection;
  let sandboxStub: SinonSandbox;

  beforeEach(async () => {
    sandboxStub = createSandbox();
    $$.setConfigStubContents('AuthInfoConfig', {
      contents: await testData.getConfig(),
    });
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username,
      }),
    });
    const mockFS = sandboxStub.stub(fs, 'readFileSync');
    mockFS.withArgs('file/path/one.cls', 'utf8').returns('public with sharing class TestAPI {}');

    mockFS.withArgs('file/path/one.cls-meta.xml', 'utf8').returns(simpleMetaXMLString);
  });

  afterEach(() => {
    sandboxStub.restore();
  });

  it('should create a metadata field with package versions', () => {
    const deployLibrary = new ContainerDeploy(mockConnection);
    const testMetadataField = {
      apiVersion: '47.0',
      status: 'Active',
      packageVersions: '      1      0      packageA    ',
    };
    let metaXMLString = '<?xml version="1.0" encoding="UTF-8"?>';
    metaXMLString += '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">';
    metaXMLString += '    <apiVersion>47.0</apiVersion>';
    metaXMLString += '    <packageVersions>';
    metaXMLString += '      <majorNumber>1</majorNumber>';
    metaXMLString += '      <minorNumber>0</minorNumber>';
    metaXMLString += '      <namespace>packageA</namespace>';
    metaXMLString += '    </packageVersions>';
    metaXMLString += '    <packageVersions>';
    metaXMLString += '      <majorNumber>8</majorNumber>';
    metaXMLString += '      <minorNumber>21</minorNumber>';
    metaXMLString += '      <namespace>packageB</namespace>';
    metaXMLString += '    </packageVersions>';
    metaXMLString += '    <status>Active</status>';
    metaXMLString += '</ApexClass>';

    const metadataField = deployLibrary.buildMetadataField(metaXMLString);
    expect(metadataField).to.deep.equals(testMetadataField);
  });

  it('should throw an error for incorrect metadata file', () => {
    const deployLibrary = new ContainerDeploy(mockConnection);
    const metaXMLString = 'Incorrect metadata file';

    assert.throws(
      () => deployLibrary.buildMetadataField(metaXMLString),
      nls.localize('error_parsing_metadata_file')
    );
  });
});
