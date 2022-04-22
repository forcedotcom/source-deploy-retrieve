/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'path';
import { assert, expect } from 'chai';
import { Messages, SfError } from '@salesforce/core';
import { MatchingContentSourceAdapter } from '../../../src/resolve/adapters';
import { matchingContentFile } from '../../mock';
import { RegistryTestUtil } from '../registryTestUtil';
import { registry, RegistryAccess, SourceComponent, VirtualTreeContainer } from '../../../src';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.load('@salesforce/source-deploy-retrieve', 'sdr', [
  'error_no_source_ignore',
  'error_expected_source_files',
]);

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
      messages.getMessage('error_no_source_ignore', [type.name, path])
    );
    testUtil.restore();
  });
});
