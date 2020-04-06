/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { mockRegistry, simon } from '../../mock/registry';
import { expect } from 'chai';
import { createSandbox } from 'sinon';
import * as util from '../../../src/metadata-registry/util';
import { Bundle } from '../../../src/metadata-registry/adapters/bundle';
import * as fs from 'fs';
import { basename } from 'path';

const env = createSandbox();

describe('Bundle', () => {
  const type = mockRegistry.types.simonpegg;
  const adapter = new Bundle(type, mockRegistry);

  const {
    SIMON_BUNDLE_PATH,
    SIMON_XML_PATH,
    SIMON_SOURCE_PATHS,
    SIMON_DIR,
    SIMON_COMPONENT
  } = simon;
  const bundleName = basename(SIMON_BUNDLE_PATH);

  before(() => {
    const walkStub = env.stub(util, 'walk');
    const findXmlStub = env.stub(util, 'findMetadataXml');
    const findContentStub = env.stub(util, 'findMetadataContent');
    const isDirStub = env.stub(util, 'isDirectory');
    const existsStub = env.stub(fs, 'existsSync');
    findXmlStub.withArgs(SIMON_BUNDLE_PATH, bundleName).returns(SIMON_XML_PATH);
    findContentStub.withArgs(SIMON_DIR, bundleName).returns(SIMON_BUNDLE_PATH);
    existsStub.withArgs(SIMON_BUNDLE_PATH).returns(true);
    isDirStub.withArgs(SIMON_BUNDLE_PATH).returns(true);
    walkStub
      .withArgs(SIMON_BUNDLE_PATH, new Set([SIMON_XML_PATH]))
      .returns(SIMON_SOURCE_PATHS);
  });

  after(() => env.restore());

  it('Should return expected MetadataComponent when given a root metadata xml path', () => {
    expect(adapter.getComponent(SIMON_XML_PATH)).to.deep.equal(SIMON_COMPONENT);
  });

  it('Should return expected MetadataComponent when given a source path', () => {
    const randomSource =
      SIMON_SOURCE_PATHS[
        Math.floor(Math.random() * Math.floor(SIMON_SOURCE_PATHS.length))
      ];
    expect(adapter.getComponent(randomSource)).to.deep.equal(SIMON_COMPONENT);
  });
});
