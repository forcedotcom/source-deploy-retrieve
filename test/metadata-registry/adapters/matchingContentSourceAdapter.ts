/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MatchingContentSourceAdapter } from '../../../src/metadata-registry/adapters/matchingContentSourceAdapter';
import { mockRegistry, keanu } from '../../mock/registry';
import { expect, assert } from 'chai';
import { ExpectedSourceFilesError, UnexpectedForceIgnore } from '../../../src/errors';
import { join } from 'path';
import { RegistryTestUtil } from '../registryTestUtil';
import { nls } from '../../../src/i18n';

const testUtil = new RegistryTestUtil();

describe('MatchingContentFile', () => {
  let adapter: MatchingContentSourceAdapter;
  const type = mockRegistry.types.keanureeves;
  const { KEANU_SOURCE_PATHS, KEANU_XML_PATHS, KEANU_COMPONENT, KEANUS_DIR } = keanu;

  beforeEach(() => {
    adapter = new MatchingContentSourceAdapter(type, mockRegistry);
    testUtil.initStubs();
  });
  afterEach(() => testUtil.restore());

  it('Should return expected MetadataComponent when given a root metadata xml path', () => {
    testUtil.exists(KEANU_SOURCE_PATHS[0], true);
    expect(adapter.getComponent(KEANU_XML_PATHS[0])).to.deep.equal(KEANU_COMPONENT);
  });

  it('Should return expected MetadataComponent when given a source path', () => {
    expect(adapter.getComponent(KEANU_SOURCE_PATHS[0])).to.deep.equal(KEANU_COMPONENT);
  });

  it('Should throw an ExpectedSourceFilesError if no source is found from xml', () => {
    testUtil.exists(KEANU_SOURCE_PATHS[0], false);
    assert.throws(() => adapter.getComponent(KEANU_XML_PATHS[0]), ExpectedSourceFilesError);
  });

  it('Should throw an ExpectedSourceFilesError if source and suffix not found', () => {
    const path = join(KEANUS_DIR, 'b.xyz');
    testUtil.exists(path, true);
    assert.throws(() => adapter.getComponent(path), ExpectedSourceFilesError);
  });

  it('Should throw an error if content file is forceignored', () => {
    const path = KEANU_SOURCE_PATHS[0];
    const forceIgnore = testUtil.stubForceIgnore({
      seed: KEANU_XML_PATHS[0],
      deny: [path]
    });
    adapter = new MatchingContentSourceAdapter(type, mockRegistry, forceIgnore);
    assert.throws(
      () => adapter.getComponent(path),
      UnexpectedForceIgnore,
      nls.localize('error_no_source_ignore', [type.name, path])
    );
  });
});
