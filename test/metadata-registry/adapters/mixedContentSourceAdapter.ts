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
  DWAYNE_SOURCE_NAME,
  mockRegistryData,
} from '../../mock/registry';
import { expect, assert } from 'chai';
import { MixedContentSourceAdapter } from '../../../src/metadata-registry/adapters/mixedContentSourceAdapter';
import { ExpectedSourceFilesError } from '../../../src/errors';
import { VirtualTreeContainer } from '../../../src/metadata-registry/treeContainers';
import { SourceComponent } from '../../../src/metadata-registry';
import { TARAJI_VIRTUAL_FS_NO_XML, TARAJI_CONTENT_PATH } from '../../mock/registry/tarajiConstants';

describe('MixedContentSourceAdapter', () => {
  it('Should throw ExpectedSourceFilesError if content does not exist', () => {
    const type = mockRegistryData.types.dwaynejohnson;
    const tree = new VirtualTreeContainer([
      {
        dirPath: DWAYNE_DIR,
        children: [DWAYNE_XML_NAME],
      },
    ]);
    const adapter = new MixedContentSourceAdapter(type, mockRegistry, undefined, tree);
    assert.throws(() => adapter.getComponent(DWAYNE_SOURCE), ExpectedSourceFilesError);
  });

  describe('File Content', () => {
    const type = mockRegistryData.types.dwaynejohnson;
    const tree = new VirtualTreeContainer([
      {
        dirPath: DWAYNE_DIR,
        children: [DWAYNE_XML_NAME, DWAYNE_SOURCE_NAME],
      },
    ]);
    const adapter = new MixedContentSourceAdapter(type, mockRegistry, undefined, tree);
    const expectedComponent = new SourceComponent(
      {
        name: 'a',
        type,
        xml: DWAYNE_XML,
        content: DWAYNE_SOURCE,
      },
      tree
    );

    it('Should return expected SourceComponent when given a root metadata xml path', () => {
      expect(adapter.getComponent(DWAYNE_XML)).to.deep.equal(expectedComponent);
    });

    it('Should return expected SourceComponent when given a source path', () => {
      expect(adapter.getComponent(DWAYNE_SOURCE)).to.deep.equal(expectedComponent);
    });
  });

  describe('Directory Content', () => {
    const { TARAJI_COMPONENT, TARAJI_SOURCE_PATHS, TARAJI_XML_PATHS, TARAJI_VIRTUAL_FS } = taraji;
    const type = mockRegistryData.types.tarajihenson;
    const tree = new VirtualTreeContainer(TARAJI_VIRTUAL_FS);
    const adapter = new MixedContentSourceAdapter(type, mockRegistry, undefined, tree);
    const expectedComponent = new SourceComponent(TARAJI_COMPONENT, tree);

    it('Should return expected SourceComponent when given a root metadata xml path', () => {
      expect(adapter.getComponent(TARAJI_XML_PATHS[0])).to.deep.equal(expectedComponent);
    });

    it('Should return expected SourceComponent when given a source path', () => {
      const randomSource =
        TARAJI_SOURCE_PATHS[Math.floor(Math.random() * Math.floor(TARAJI_SOURCE_PATHS.length))];
      expect(adapter.getComponent(randomSource)).to.deep.equal(expectedComponent);
    });

    it('should return expected SourceComponent when there is no metadata xml', () => {
      const tree = new VirtualTreeContainer(TARAJI_VIRTUAL_FS_NO_XML);
      const adapter = new MixedContentSourceAdapter(type, mockRegistry, undefined, tree);
      const expectedComponent = new SourceComponent(
        {
          name: 'a',
          type,
          content: TARAJI_CONTENT_PATH,
        },
        tree
      );
      expect(adapter.getComponent(taraji.TARAJI_CONTENT_PATH)).to.deep.equal(expectedComponent);
    });
  });
});
