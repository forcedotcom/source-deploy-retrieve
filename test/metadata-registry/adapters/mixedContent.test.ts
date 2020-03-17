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
import { expect } from 'chai';
import { join } from 'path';
import { createSandbox, SinonStub } from 'sinon';
import * as fs from 'fs';
import * as util from '../../../src/metadata-registry/util';
import { MixedContent } from '../../../src/metadata-registry/adapters/mixedContent';

const env = createSandbox();

describe('MixedContent', () => {
  let existsStub: SinonStub;
  let findXmlStub: SinonStub;
  let findContentStub: SinonStub;
  let dirStub: SinonStub;

  beforeEach(() => {
    existsStub = env.stub(fs, 'existsSync');
    findXmlStub = env.stub(util, 'findMetadataXml');
    findContentStub = env.stub(util, 'findMetadataContent');
    dirStub = env.stub(util, 'isDirectory');
  });

  afterEach(() => env.restore());

  describe('Content as single file', () => {
    const type = mockRegistry.types.dwaynejohnson;
    const adapter = new MixedContent(type, mockRegistry);
    const expectedComponent = {
      fullName: 'a',
      type,
      metaXml: DWAYNE_XML,
      sources: [DWAYNE_SOURCE]
    };

    it('Should return expected MetadataComponent when given a root metadata xml path', () => {
      dirStub.returns(false);
      findContentStub.withArgs(DWAYNE_DIR, 'a').returns(DWAYNE_SOURCE);

      expect(adapter.getComponent(DWAYNE_XML)).to.deep.equal(expectedComponent);
    });

    it('Should return expected MetadataComponent when given a source path', () => {
      findXmlStub.returns(DWAYNE_XML);
      dirStub.returns(false);

      expect(adapter.getComponent(DWAYNE_SOURCE)).to.deep.equal(
        expectedComponent
      );
    });
  });

  describe('Content as directory', () => {
    let walkStub: SinonStub;

    const type = mockRegistry.types.tarajihenson;
    const adapter = new MixedContent(type, mockRegistry);
    const sources = [TARAJI_SOURCE_1, TARAJI_SOURCE_2, TARAJI_SOURCE_3];
    const expectedComponent = {
      fullName: 'a',
      type,
      metaXml: TARAJI_XML,
      sources
    };

    beforeEach(() => (walkStub = env.stub(util, 'walk')));

    it('Should return expected MetadataComponent when given a root metadata xml path', () => {
      findContentStub.withArgs(TARAJI_DIR, 'a').returns(TARAJI_CONTENT);
      dirStub.returns(true);
      walkStub.withArgs(TARAJI_CONTENT, new Set([TARAJI_XML])).returns(sources);

      expect(adapter.getComponent(TARAJI_XML)).to.deep.equal(expectedComponent);
    });

    it('Should return expected MetadataComponent when given a source path', () => {
      findXmlStub.returns(TARAJI_XML);
      dirStub.returns(true);
      walkStub.withArgs(TARAJI_CONTENT, new Set([TARAJI_XML])).returns(sources);

      const randomSource =
        sources[Math.floor(Math.random() * Math.floor(sources.length))];
      expect(adapter.getComponent(randomSource)).to.deep.equal(
        expectedComponent
      );
    });
  });
});
