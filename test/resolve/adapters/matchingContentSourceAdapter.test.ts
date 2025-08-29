/*
 * Copyright 2025, Salesforce, Inc.
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
import { MatchingContentSourceAdapter } from '../../../src/resolve/adapters';
import { matchingContentFile } from '../../mock';
import { RegistryTestUtil } from '../registryTestUtil';
import { registry, RegistryAccess, SourceComponent, VirtualTreeContainer } from '../../../src';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

describe('MatchingContentSourceAdapter', () => {
  const registryAccess = new RegistryAccess();
  const type = registry.types.apexclass;
  const { CONTENT_PATHS, XML_PATHS, COMPONENT, TYPE_DIRECTORY, CONTENT_NAMES, XML_NAMES } = matchingContentFile;
  const tree = new VirtualTreeContainer([
    {
      dirPath: TYPE_DIRECTORY,
      children: [CONTENT_NAMES[0], XML_NAMES[0]],
    },
  ]);
  const expectedComponent = new SourceComponent(COMPONENT, tree);
  const adapter = new MatchingContentSourceAdapter(type, registryAccess, undefined, tree);

  it('Should return expected SourceComponent when given a root metadata xml path', () => {
    expect(adapter.getComponent(XML_PATHS[0])).to.deep.equal(expectedComponent);
  });

  it('Should return expected SourceComponent when given a source path', () => {
    expect(adapter.getComponent(CONTENT_PATHS[0])).to.deep.equal(expectedComponent);
  });

  it('Should throw an ExpectedSourceFilesError if no source is found from xml', () => {
    const path = join(TYPE_DIRECTORY, 'b.xyz-meta.xml');
    assert.throws(
      () => adapter.getComponent(path),
      SfError,
      messages.getMessage('error_expected_source_files', [path, type.name])
    );
  });

  it('Should throw an ExpectedSourceFilesError if source and suffix not found', () => {
    const path = join(TYPE_DIRECTORY, 'b.xyz');
    assert.throws(
      () => adapter.getComponent(path),
      SfError,
      messages.getMessage('error_expected_source_files', [path, type.name])
    );
  });

  it('Should throw an error if content file is forceignored', () => {
    const testUtil = new RegistryTestUtil();
    const path = CONTENT_PATHS[0];
    const forceIgnore = testUtil.stubForceIgnore({
      seed: XML_PATHS[0],
      deny: [path],
    });
    const adapter = new MatchingContentSourceAdapter(type, registryAccess, forceIgnore, tree);
    assert.throws(
      () => adapter.getComponent(path),
      SfError,
      messages.createError('noSourceIgnore', [type.name, path]).message
    );
    testUtil.restore();
  });
});
