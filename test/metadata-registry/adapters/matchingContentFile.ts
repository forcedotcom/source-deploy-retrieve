/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MatchingContentFile } from '../../../src/metadata-registry/adapters/matchingContentFile';
import {
  mockRegistry,
  KEANU_XML,
  KEANU_SOURCE,
  KEANUS_DIR,
  KEANU_COMPONENT
} from '../../mock/registry';
import { expect, assert } from 'chai';
import { createSandbox, SinonStub } from 'sinon';
import * as fs from 'fs';
import { ExpectedSourceFilesError } from '../../../src/errors';
import { join } from 'path';

const env = createSandbox();

describe('MatchingContentFile', () => {
  let existsStub: SinonStub;

  beforeEach(() => (existsStub = env.stub(fs, 'existsSync')));
  afterEach(() => existsStub.restore());

  const adapter = new MatchingContentFile(
    mockRegistry.types.keanureeves,
    mockRegistry
  );

  it('Should return expected MetadataComponent when given a root metadata xml path', () => {
    existsStub.withArgs(KEANU_SOURCE).returns(true);
    expect(adapter.getComponent(KEANU_XML)).to.deep.equal(KEANU_COMPONENT);
  });

  it('Should return expected MetadataComponent when given a source path', () => {
    expect(adapter.getComponent(KEANU_SOURCE)).to.deep.equal(KEANU_COMPONENT);
  });

  it('Should throw an ExpectedSourceFilesError if no source is found from xml', () => {
    existsStub.withArgs(KEANU_SOURCE).returns(false);
    assert.throws(
      () => adapter.getComponent(KEANU_XML),
      ExpectedSourceFilesError
    );
  });

  it('Should throw an ExpectedSourceFilesError if source and suffix not found', () => {
    const path = join(KEANUS_DIR, 'b.xyz');
    existsStub.withArgs(path).returns(true);
    assert.throws(() => adapter.getComponent(path), ExpectedSourceFilesError);
  });
});
