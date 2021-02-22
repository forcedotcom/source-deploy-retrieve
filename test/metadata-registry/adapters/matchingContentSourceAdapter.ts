/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { MatchingContentSourceAdapter } from '../../../src/metadata-registry/adapters/matchingContentSourceAdapter';
import { mockRegistry, matchingContentFile, mockRegistryData } from '../../mock/registry';
import { expect, assert } from 'chai';
import { ExpectedSourceFilesError, UnexpectedForceIgnore } from '../../../src/errors';
import { join } from 'path';
import { RegistryTestUtil } from '../registryTestUtil';
import { nls } from '../../../src/i18n';
import { VirtualTreeContainer } from '../../../src/metadata-registry/treeContainers';
import { SourceComponent } from '../../../src/metadata-registry';

describe('MatchingContentSourceAdapter', () => {
  const type = mockRegistryData.types.matchingcontentfile;
  const {
    CONTENT_PATHS,
    XML_PATHS,
    COMPONENT,
    TYPE_DIRECTORY,
    CONTENT_NAMES,
    XML_NAMES,
  } = matchingContentFile;
  const tree = new VirtualTreeContainer([
    {
      dirPath: TYPE_DIRECTORY,
      children: [CONTENT_NAMES[0], XML_NAMES[0]],
    },
  ]);
  const expectedComponent = new SourceComponent(COMPONENT, tree);
  const adapter = new MatchingContentSourceAdapter(type, mockRegistry, undefined, tree);

  it('Should return expected SourceComponent when given a root metadata xml path', () => {
    expect(adapter.getComponent(XML_PATHS[0])).to.deep.equal(expectedComponent);
  });

  it('Should return expected SourceComponent when given a source path', () => {
    expect(adapter.getComponent(CONTENT_PATHS[0])).to.deep.equal(expectedComponent);
  });

  it('Should throw an ExpectedSourceFilesError if no source is found from xml', () => {
    const path = join(TYPE_DIRECTORY, 'b.xyz-meta.xml');
    assert.throws(() => adapter.getComponent(path), ExpectedSourceFilesError);
  });

  it('Should throw an ExpectedSourceFilesError if source and suffix not found', () => {
    const path = join(TYPE_DIRECTORY, 'b.xyz');
    assert.throws(() => adapter.getComponent(path), ExpectedSourceFilesError);
  });

  it('Should throw an error if content file is forceignored', () => {
    const testUtil = new RegistryTestUtil();
    const path = CONTENT_PATHS[0];
    const forceIgnore = testUtil.stubForceIgnore({
      seed: XML_PATHS[0],
      deny: [path],
    });
    const adapter = new MatchingContentSourceAdapter(type, mockRegistry, forceIgnore, tree);
    assert.throws(
      () => adapter.getComponent(path),
      UnexpectedForceIgnore,
      nls.localize('error_no_source_ignore', [type.name, path])
    );
    testUtil.restore();
  });
});
