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
import { join } from 'node:path';
import { assert, expect } from 'chai';
import { Messages, SfError } from '@salesforce/core';
import { ForceIgnore, RegistryAccess, SourceComponent, VirtualTreeContainer, registry } from '../../../src';
import { WebApplicationsSourceAdapter } from '../../../src/resolve/adapters';
import { RegistryTestUtil } from '../registryTestUtil';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

describe('WebApplicationsSourceAdapter', () => {
  const BASE_PATH = join('path', 'to', registry.types.webapplication.directoryName);
  const APP_NAME = 'Zenith';
  const APP_PATH = join(BASE_PATH, APP_NAME);
  const META_FILE = join(APP_PATH, `${APP_NAME}.webapplication-meta.xml`);
  const JSON_FILE = join(APP_PATH, 'webapplication.json');
  const CONTENT_FILE = join(APP_PATH, 'src', 'index.html');

  const registryAccess = new RegistryAccess();
  const forceIgnore = new ForceIgnore();
  const tree = VirtualTreeContainer.fromFilePaths([META_FILE, JSON_FILE, CONTENT_FILE]);
  const adapter = new WebApplicationsSourceAdapter(registry.types.webapplication, registryAccess, forceIgnore, tree);

  const expectedComponent = new SourceComponent(
    {
      name: APP_NAME,
      type: registry.types.webapplication,
      content: APP_PATH,
      xml: META_FILE,
    },
    tree,
    forceIgnore
  );

  it('should return a SourceComponent for the metadata xml', () => {
    expect(adapter.getComponent(META_FILE)).to.deep.equal(expectedComponent);
  });

  it('should return a SourceComponent for the descriptor json', () => {
    expect(adapter.getComponent(JSON_FILE)).to.deep.equal(expectedComponent);
  });

  it('should return a SourceComponent for any content file in the app', () => {
    expect(adapter.getComponent(CONTENT_FILE)).to.deep.equal(expectedComponent);
  });

  it('should return a SourceComponent for the app directory', () => {
    expect(adapter.getComponent(APP_PATH)).to.deep.equal(expectedComponent);
  });

  it('should throw ExpectedSourceFilesError if metadata xml is missing', () => {
    const noXmlTree = VirtualTreeContainer.fromFilePaths([JSON_FILE, CONTENT_FILE]);
    const noXmlAdapter = new WebApplicationsSourceAdapter(
      registry.types.webapplication,
      registryAccess,
      forceIgnore,
      noXmlTree
    );
    const expectedXmlPath = join(APP_PATH, `${APP_NAME}.webapplication-meta.xml`);
    assert.throws(
      () => noXmlAdapter.getComponent(APP_PATH),
      SfError,
      messages.getMessage('error_expected_source_files', [expectedXmlPath, registry.types.webapplication.name])
    );
  });

  it('should throw ExpectedSourceFilesError if content files are missing', () => {
    const noContentTree = VirtualTreeContainer.fromFilePaths([META_FILE, JSON_FILE]);
    const noContentAdapter = new WebApplicationsSourceAdapter(
      registry.types.webapplication,
      registryAccess,
      forceIgnore,
      noContentTree
    );
    assert.throws(
      () => noContentAdapter.getComponent(APP_PATH),
      SfError,
      messages.getMessage('error_expected_source_files', [APP_PATH, registry.types.webapplication.name])
    );
  });

  it('should throw ExpectedSourceFilesError if webapplication.json is missing', () => {
    const noJsonTree = VirtualTreeContainer.fromFilePaths([META_FILE, CONTENT_FILE]);
    const noJsonAdapter = new WebApplicationsSourceAdapter(
      registry.types.webapplication,
      registryAccess,
      forceIgnore,
      noJsonTree
    );
    const expectedJsonPath = join(APP_PATH, 'webapplication.json');
    assert.throws(
      () => noJsonAdapter.getComponent(APP_PATH),
      SfError,
      messages.getMessage('error_expected_source_files', [expectedJsonPath, registry.types.webapplication.name])
    );
  });

  it('should allow missing webapplication.json when resolving metadata', () => {
    const metadataTree = VirtualTreeContainer.fromFilePaths([META_FILE]);
    const metadataAdapter = new WebApplicationsSourceAdapter(
      registry.types.webapplication,
      registryAccess,
      forceIgnore,
      metadataTree
    );
    const expectedMetadataComponent = new SourceComponent(
      {
        name: APP_NAME,
        type: registry.types.webapplication,
        content: APP_PATH,
        xml: META_FILE,
      },
      metadataTree,
      forceIgnore
    );

    expect(metadataAdapter.getComponent(META_FILE, false)).to.deep.equal(expectedMetadataComponent);
  });

  it('should throw noSourceIgnore if webapplication.json is forceignored', () => {
    const testUtil = new RegistryTestUtil();
    const forceIgnore = testUtil.stubForceIgnore({
      seed: APP_PATH,
      deny: [JSON_FILE],
    });
    const ignoredAdapter = new WebApplicationsSourceAdapter(
      registry.types.webapplication,
      registryAccess,
      forceIgnore,
      tree
    );

    assert.throws(
      () => ignoredAdapter.getComponent(APP_PATH),
      SfError,
      messages.getMessage('noSourceIgnore', [registry.types.webapplication.name, JSON_FILE])
    );
    testUtil.restore();
  });
});
