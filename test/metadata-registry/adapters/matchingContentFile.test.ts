/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MatchingContentFile } from '../../../src/metadata-registry/adapters/matchingContentFile';
import { mockRegistry, KEANU_XML, KEANU_SOURCE } from '../../mock/registry';
import { expect } from 'chai';
import { join } from 'path';
import { createSandbox, SinonStub } from 'sinon';
import * as fs from 'fs';

const env = createSandbox();

describe('MatchingContentFile', () => {
  let existsStub: SinonStub;

  beforeEach(() => (existsStub = env.stub(fs, 'existsSync')));
  afterEach(() => existsStub.restore());

  const adapter = new MatchingContentFile(
    mockRegistry.types.keanureeves,
    mockRegistry
  );
  const expectedComponent = {
    fullName: 'a',
    type: mockRegistry.types.keanureeves,
    metaXml: KEANU_XML,
    sources: [KEANU_SOURCE]
  };

  it('Should return expected MetadataComponent when given a root metadata xml path', () => {
    existsStub.withArgs(KEANU_SOURCE).returns(true);
    expect(adapter.getComponent(KEANU_XML)).to.deep.equal(expectedComponent);
  });

  it('Should return expected MetadataComponent when given a source path', () => {
    expect(adapter.getComponent(KEANU_SOURCE)).to.deep.equal(expectedComponent);
  });
});
