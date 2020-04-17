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
  taraji
} from '../../mock/registry';
import { expect, assert } from 'chai';
import { createSandbox, SinonStub } from 'sinon';
import * as fs from 'fs';
import * as util from '../../../src/metadata-registry/util';
import * as fsUtil from '../../../src/utils/fileSystemHandler';
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
    dirStub = env.stub(fsUtil, 'isDirectory');
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

    const {
      TARAJI_COMPONENT,
      TARAJI_CONTENT_PATH,
      TARAJI_SOURCE_PATHS,
      TARAJI_XML_PATHS
    } = taraji;

    beforeEach(() => (walkStub = env.stub(util, 'walk')));

    it('Should return expected MetadataComponent when given a root metadata xml path', () => {
      findContentStub
        .withArgs(taraji.TARAJI_DIR, 'a')
        .returns(TARAJI_CONTENT_PATH);
      dirStub.returns(true);
      existsStub.withArgs(TARAJI_CONTENT_PATH).returns(true);
      walkStub
        .withArgs(TARAJI_CONTENT_PATH, new Set([TARAJI_XML_PATHS[0]]))
        .returns(TARAJI_SOURCE_PATHS);

      expect(adapter.getComponent(TARAJI_XML_PATHS[0])).to.deep.equal(
        TARAJI_COMPONENT
      );
    });

    it('Should return expected MetadataComponent when given a source path', () => {
      findXmlStub.returns(TARAJI_XML_PATHS[0]);
      dirStub.returns(true);
      existsStub.withArgs(TARAJI_CONTENT_PATH).returns(true);
      walkStub
        .withArgs(TARAJI_CONTENT_PATH, new Set([TARAJI_XML_PATHS[0]]))
        .returns(TARAJI_SOURCE_PATHS);

      const randomSource =
        TARAJI_SOURCE_PATHS[
          Math.floor(Math.random() * Math.floor(TARAJI_SOURCE_PATHS.length))
        ];
      expect(adapter.getComponent(randomSource)).to.deep.equal(
        TARAJI_COMPONENT
      );
    });
  });
});
