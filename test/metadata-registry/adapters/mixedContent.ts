/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  mockRegistry,
  DWAYNE_SOURCE,
  DWAYNE_XML,
  DWAYNE_DIR,
  TARAJI_XML,
  TARAJI_SOURCE_1,
  TARAJI_SOURCE_2,
  TARAJI_SOURCE_3,
  TARAJI_DIR,
  TARAJI_CONTENT
} from '../../mock/registry';
import { expect, assert } from 'chai';
import { createSandbox, SinonStub } from 'sinon';
import * as fs from 'fs';
import * as util from '../../../src/metadata-registry/util';
import { MixedContent } from '../../../src/metadata-registry/adapters/mixedContent';
import { ExpectedSourceFilesError } from '../../../src/errors';

const env = createSandbox();

describe('MixedContent', () => {
  let findXmlStub: SinonStub;
  let findContentStub: SinonStub;
  let dirStub: SinonStub;
  let existsStub: SinonStub;

  beforeEach(() => {
    findXmlStub = env.stub(util, 'findMetadataXml');
    findContentStub = env.stub(util, 'findMetadataContent');
    dirStub = env.stub(util, 'isDirectory');
    existsStub = env.stub(fs, 'existsSync');
  });

  afterEach(() => env.restore());

  it('Should throw ExpectedSourceFilesError if content does not exist', () => {
    const adapter = new MixedContent(
      mockRegistry.types.dwaynejohnson,
      mockRegistry
    );
    existsStub.withArgs(DWAYNE_SOURCE).returns(false);
    findXmlStub.returns(DWAYNE_XML);
    assert.throws(
      () => adapter.getComponent(DWAYNE_SOURCE),
      ExpectedSourceFilesError
    );
  });

  describe('File Content', () => {
    const type = mockRegistry.types.dwaynejohnson;
    const adapter = new MixedContent(type, mockRegistry);
    const expectedComponent = {
      fullName: 'a',
      type,
      xml: DWAYNE_XML,
      sources: [DWAYNE_SOURCE]
    };

    it('Should return expected MetadataComponent when given a root metadata xml path', () => {
      dirStub.returns(false);
      findContentStub.withArgs(DWAYNE_DIR, 'a').returns(DWAYNE_SOURCE);
      existsStub.withArgs(DWAYNE_SOURCE).returns(true);

      expect(adapter.getComponent(DWAYNE_XML)).to.deep.equal(expectedComponent);
    });

    it('Should return expected MetadataComponent when given a source path', () => {
      findXmlStub.returns(DWAYNE_XML);
      dirStub.returns(false);
      existsStub.withArgs(DWAYNE_SOURCE).returns(true);

      expect(adapter.getComponent(DWAYNE_SOURCE)).to.deep.equal(
        expectedComponent
      );
    });
  });

  describe('Directory Content', () => {
    let walkStub: SinonStub;

    const type = mockRegistry.types.tarajihenson;
    const adapter = new MixedContent(type, mockRegistry);
    const sources = [TARAJI_SOURCE_1, TARAJI_SOURCE_2, TARAJI_SOURCE_3];
    const expectedComponent = {
      fullName: 'a',
      type,
      xml: TARAJI_XML,
      sources
    };

    beforeEach(() => (walkStub = env.stub(util, 'walk')));

    it('Should return expected MetadataComponent when given a root metadata xml path', () => {
      findContentStub.withArgs(TARAJI_DIR, 'a').returns(TARAJI_CONTENT);
      dirStub.returns(true);
      existsStub.withArgs(TARAJI_CONTENT).returns(true);
      walkStub.withArgs(TARAJI_CONTENT, new Set([TARAJI_XML])).returns(sources);

      expect(adapter.getComponent(TARAJI_XML)).to.deep.equal(expectedComponent);
    });

    it('Should return expected MetadataComponent when given a source path', () => {
      findXmlStub.returns(TARAJI_XML);
      dirStub.returns(true);
      existsStub.withArgs(TARAJI_CONTENT).returns(true);
      walkStub.withArgs(TARAJI_CONTENT, new Set([TARAJI_XML])).returns(sources);

      const randomSource =
        sources[Math.floor(Math.random() * Math.floor(sources.length))];
      expect(adapter.getComponent(randomSource)).to.deep.equal(
        expectedComponent
      );
    });
  });
});
