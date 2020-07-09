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
import { MixedContentSourceAdapter } from '../../../src/metadata-registry/adapters/mixedContentSourceAdapter';
import { ExpectedSourceFilesError } from '../../../src/errors';
import { VirtualTreeContainer } from '../../../src/metadata-registry/treeContainers';
import { TARAJI_XML_NAMES } from '../../mock/registry/tarajiConstants';
import { basename, dirname } from 'path';
import { StandardSourceComponent } from '../../../src/metadata-registry';

describe('MixedContentSourceAdapter', () => {
  it('Should throw ExpectedSourceFilesError if content does not exist', () => {
    const type = mockRegistry.types.dwaynejohnson;
    const tree = new VirtualTreeContainer([
      {
        dirPath: DWAYNE_DIR,
        children: [DWAYNE_XML_NAME]
      }
    ]);
    const adapter = new MixedContentSourceAdapter(type, mockRegistry, undefined, tree);
    assert.throws(() => adapter.getComponent(DWAYNE_SOURCE), ExpectedSourceFilesError);
  });

  describe('File Content', () => {
    const type = mockRegistry.types.dwaynejohnson;
    const tree = new VirtualTreeContainer([
      {
        dirPath: DWAYNE_DIR,
        children: [DWAYNE_XML_NAME, DWAYNE_SOURCE_NAME]
      }
    ]);
    const adapter = new MixedContentSourceAdapter(type, mockRegistry, undefined, tree);
    const expectedComponent = new StandardSourceComponent(
      {
        name: 'a',
        type,
        xml: DWAYNE_XML,
        content: DWAYNE_SOURCE
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
    const { TARAJI_COMPONENT, TARAJI_CONTENT_PATH, TARAJI_SOURCE_PATHS, TARAJI_XML_PATHS } = taraji;
    const type = mockRegistry.types.tarajihenson;
    const tree = new VirtualTreeContainer([
      {
        dirPath: taraji.TARAJI_DIR,
        children: [TARAJI_XML_NAMES[0], basename(TARAJI_CONTENT_PATH)]
      },
      {
        dirPath: TARAJI_CONTENT_PATH,
        children: [basename(TARAJI_SOURCE_PATHS[0]), basename(dirname(TARAJI_SOURCE_PATHS[1]))]
      },
      {
        dirPath: dirname(TARAJI_SOURCE_PATHS[1]),
        children: [basename(TARAJI_SOURCE_PATHS[1]), basename(TARAJI_SOURCE_PATHS[2])]
      }
    ]);
    const adapter = new MixedContentSourceAdapter(type, mockRegistry, undefined, tree);
    const expectedComponent = new StandardSourceComponent(TARAJI_COMPONENT, tree);

    it('Should return expected SourceComponent when given a root metadata xml path', () => {
      expect(adapter.getComponent(TARAJI_XML_PATHS[0])).to.deep.equal(expectedComponent);
    });

    it('Should return expected SourceComponent when given a source path', () => {
      const randomSource =
        TARAJI_SOURCE_PATHS[Math.floor(Math.random() * Math.floor(TARAJI_SOURCE_PATHS.length))];
      expect(adapter.getComponent(randomSource)).to.deep.equal(expectedComponent);
    });

    // TODO: Move to StandardSourceComponent tests
    // it('Should not include source paths that are forceignored', () => {
    //   const testUtil = new RegistryTestUtil();
    //   const path = TARAJI_SOURCE_PATHS[0];
    //   const forceIgnore = testUtil.stubForceIgnore({
    //     seed: path,
    //     accept: [TARAJI_SOURCE_PATHS[1]],
    //     deny: [TARAJI_SOURCE_PATHS[0], TARAJI_SOURCE_PATHS[2]]
    //   });
    //   const adapter = new MixedContentSourceAdapter(type, mockRegistry, forceIgnore, tree);
    //   const expectedComponent = new StandardSourceComponent()
    //   const filteredComponent: SourceComponent = JSON.parse(JSON.stringify(TARAJI_COMPONENT));
    //   filteredComponent.sources = [TARAJI_SOURCE_PATHS[1]];
    //   expect(adapter.getComponent(path)).to.deep.equal(filteredComponent);
    //   testUtil.restore();
    // });
  });
});
