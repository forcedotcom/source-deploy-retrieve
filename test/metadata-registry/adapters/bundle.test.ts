/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  mockRegistry,
  KEANU_XML,
  KEANU_SOURCE,
  SIMON_XML,
  SIMON_SOURCE_1,
  SIMON_SOURCE_2,
  SIMON_SOURCE_3,
  SIMON_BUNDLE,
  SIMON_DIR
} from '../../mock/registry';
import { expect } from 'chai';
import { join } from 'path';
import { createSandbox, SinonStub } from 'sinon';
import * as fs from 'fs';
import * as util from '../../../src/metadata-registry/util';
import { Bundle } from '../../../src/metadata-registry/adapters/bundle';

const env = createSandbox();

describe('Bundle', () => {
  const type = mockRegistry.types.simonpegg;
  const adapter = new Bundle(type, mockRegistry);
  const sources = [SIMON_SOURCE_1, SIMON_SOURCE_2, SIMON_SOURCE_3];
  const expectedComponent = {
    fullName: 'a',
    type,
    metaXml: SIMON_XML,
    sources
  };

  before(() => {
    const existsStub = env.stub(fs, 'existsSync');
    const walkStub = env.stub(util, 'walk');
    const findXmlStub = env.stub(util, 'findMetadataXml');
    const findContentStub = env.stub(util, 'findMetadataContent');
    const isDirStub = env.stub(util, 'isDirectory');
    findXmlStub.withArgs(SIMON_BUNDLE, 'a').returns(SIMON_XML);
    findContentStub.withArgs(SIMON_DIR, 'a').returns(SIMON_BUNDLE);
    isDirStub.withArgs(SIMON_BUNDLE).returns(true);
    walkStub.withArgs(SIMON_BUNDLE, new Set([SIMON_XML])).returns(sources);
  });

  after(() => env.restore());

  it('Should return expected MetadataComponent when given a root metadata xml path', () => {
    expect(adapter.getComponent(SIMON_XML)).to.deep.equal(expectedComponent);
  });

  it('Should return expected MetadataComponent when given a source path', () => {
    const randomSource =
      sources[Math.floor(Math.random() * Math.floor(sources.length))];
    expect(adapter.getComponent(randomSource)).to.deep.equal(expectedComponent);
  });
});
