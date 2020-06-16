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
  taraji,
  DWAYNE_XML_NAME,
  DWAYNE_SOURCE_NAME
} from '../../mock/registry';
import { expect, assert } from 'chai';
import { createSandbox, SinonStub } from 'sinon';
import * as fs from 'fs';
import * as util from '../../../src/utils/registry';
import * as fsUtil from '../../../src/utils/fileSystemHandler';
import { MixedContentSourceAdapter } from '../../../src/metadata-registry/adapters/mixedContentSourceAdapter';
import { ExpectedSourceFilesError } from '../../../src/errors';
import { RegistryTestUtil } from '../registryTestUtil';
import { MetadataComponent } from '../../../src/types';

const env = createSandbox();

describe('MixedContentSourceAdapter', () => {
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
    const adapter = new MixedContentSourceAdapter(mockRegistry.types.dwaynejohnson, mockRegistry);
    existsStub.withArgs(DWAYNE_SOURCE).returns(false);
    findXmlStub.returns(DWAYNE_XML);
    assert.throws(() => adapter.getComponent(DWAYNE_SOURCE), ExpectedSourceFilesError);
  });

  describe('File Content', () => {
    const type = mockRegistry.types.dwaynejohnson;
    const adapter = new MixedContentSourceAdapter(type, mockRegistry);
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
      const testUtil = new RegistryTestUtil(env);
      testUtil.restore();
      testUtil.initStubs();
      testUtil.stubDirectories([
        {
          directory: DWAYNE_DIR,
          fileNames: [DWAYNE_XML_NAME, DWAYNE_SOURCE_NAME]
        }
      ]);

      expect(adapter.getComponent(DWAYNE_SOURCE)).to.deep.equal(expectedComponent);
    });
  });

  describe('Directory Content', () => {
    let walkStub: SinonStub;

    const type = mockRegistry.types.tarajihenson;
    let adapter = new MixedContentSourceAdapter(type, mockRegistry);

    const { TARAJI_COMPONENT, TARAJI_CONTENT_PATH, TARAJI_SOURCE_PATHS, TARAJI_XML_PATHS } = taraji;

    beforeEach(() => (walkStub = env.stub(fsUtil, 'walk')));

    it('Should return expected MetadataComponent when given a root metadata xml path', () => {
      findContentStub.withArgs(taraji.TARAJI_DIR, 'a').returns(TARAJI_CONTENT_PATH);
      dirStub.returns(true);
      existsStub.withArgs(TARAJI_CONTENT_PATH).returns(true);
      walkStub
        .withArgs(TARAJI_CONTENT_PATH, new Set([TARAJI_XML_PATHS[0]]))
        .returns(TARAJI_SOURCE_PATHS);

      expect(adapter.getComponent(TARAJI_XML_PATHS[0])).to.deep.equal(TARAJI_COMPONENT);
    });

    it('Should return expected MetadataComponent when given a source path', () => {
      findXmlStub.returns(TARAJI_XML_PATHS[0]);
      dirStub.returns(true);
      existsStub.withArgs(TARAJI_CONTENT_PATH).returns(true);
      walkStub
        .withArgs(TARAJI_CONTENT_PATH, new Set([TARAJI_XML_PATHS[0]]))
        .returns(TARAJI_SOURCE_PATHS);

      const randomSource =
        TARAJI_SOURCE_PATHS[Math.floor(Math.random() * Math.floor(TARAJI_SOURCE_PATHS.length))];
      expect(adapter.getComponent(randomSource)).to.deep.equal(TARAJI_COMPONENT);
    });

    it('Should not include source paths that are forceignored', () => {
      const testUtil = new RegistryTestUtil(env);
      const path = TARAJI_SOURCE_PATHS[0];
      findXmlStub.returns(TARAJI_XML_PATHS[0]);
      dirStub.returns(true);
      existsStub.withArgs(TARAJI_CONTENT_PATH).returns(true);
      walkStub
        .withArgs(TARAJI_CONTENT_PATH, new Set([TARAJI_XML_PATHS[0]]))
        .returns(TARAJI_SOURCE_PATHS);
      const forceIgnore = testUtil.stubForceIgnore({
        seed: path,
        accept: [TARAJI_SOURCE_PATHS[1]],
        deny: [TARAJI_SOURCE_PATHS[0], TARAJI_SOURCE_PATHS[2]]
      });
      adapter = new MixedContentSourceAdapter(type, mockRegistry, forceIgnore);
      // copy the object but change the expected sources
      const filteredComponent: MetadataComponent = JSON.parse(JSON.stringify(TARAJI_COMPONENT));
      filteredComponent.sources = [TARAJI_SOURCE_PATHS[1]];
      expect(adapter.getComponent(path)).to.deep.equal(filteredComponent);
    });
  });
});
