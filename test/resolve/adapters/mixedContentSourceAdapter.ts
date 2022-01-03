/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { assert, expect } from 'chai';
import { MixedContentSourceAdapter } from '../../../src/resolve/adapters';
import { ExpectedSourceFilesError } from '../../../src/errors';
import { registry, SourceComponent, VirtualTreeContainer } from '../../../src';
import {
  MIXED_CONTENT_DIRECTORY_CONTENT_PATH,
  MIXED_CONTENT_DIRECTORY_VIRTUAL_FS_NO_XML,
} from '../../mock/registry/type-constants/mixedContentDirectoryConstants';
import { mixedContentDirectory, mixedContentSingleFile } from '../../mock/registry';

describe('MixedContentSourceAdapter', () => {
  it('Should throw ExpectedSourceFilesError if content does not exist', () => {
    const type = registry.types.staticresource;
    const tree = new VirtualTreeContainer([
      {
        dirPath: mixedContentSingleFile.TYPE_DIRECTORY,
        children: [mixedContentSingleFile.XML_NAMES[0]],
      },
    ]);
    const adapter = new MixedContentSourceAdapter(type, undefined, undefined, tree);
    assert.throws(() => adapter.getComponent(mixedContentSingleFile.COMPONENT.content), ExpectedSourceFilesError);
  });

  describe('File Content', () => {
    const component = mixedContentSingleFile.COMPONENT;
    const adapter = new MixedContentSourceAdapter(registry.types.staticresource, undefined, undefined, component.tree);

    it('Should return expected SourceComponent when given a root metadata xml path', () => {
      const result = adapter.getComponent(component.xml);

      expect(result).to.deep.equal(component);
    });

    it('Should return expected SourceComponent when given a source path', () => {
      const result = adapter.getComponent(component.content);

      expect(result).to.deep.equal(component);
    });
  });

  describe('Directory Content', () => {
    const {
      MIXED_CONTENT_DIRECTORY_COMPONENT,
      MIXED_CONTENT_DIRECTORY_SOURCE_PATHS,
      MIXED_CONTENT_DIRECTORY_XML_PATHS,
      MIXED_CONTENT_DIRECTORY_VIRTUAL_FS,
    } = mixedContentDirectory;
    const type = registry.types.staticresource;
    const tree = new VirtualTreeContainer(MIXED_CONTENT_DIRECTORY_VIRTUAL_FS);
    const adapter = new MixedContentSourceAdapter(type, undefined, undefined, tree);
    const expectedComponent = new SourceComponent(MIXED_CONTENT_DIRECTORY_COMPONENT, tree);

    it('Should return expected SourceComponent when given a root metadata xml path', () => {
      expect(adapter.getComponent(MIXED_CONTENT_DIRECTORY_XML_PATHS[0])).to.deep.equal(expectedComponent);
    });

    it('Should return expected SourceComponent when given a source path', () => {
      const randomSource =
        MIXED_CONTENT_DIRECTORY_SOURCE_PATHS[
          Math.floor(Math.random() * Math.floor(MIXED_CONTENT_DIRECTORY_SOURCE_PATHS.length))
        ];
      expect(adapter.getComponent(randomSource)).to.deep.equal(expectedComponent);
    });

    it('should return expected SourceComponent when there is no metadata xml', () => {
      const tree = new VirtualTreeContainer(MIXED_CONTENT_DIRECTORY_VIRTUAL_FS_NO_XML);
      const adapter = new MixedContentSourceAdapter(type, undefined, undefined, tree);
      const expectedComponent = new SourceComponent(
        {
          name: 'a',
          type,
          content: MIXED_CONTENT_DIRECTORY_CONTENT_PATH,
        },
        tree
      );
      expect(adapter.getComponent(mixedContentDirectory.MIXED_CONTENT_DIRECTORY_CONTENT_PATH)).to.deep.equal(
        expectedComponent
      );
    });
  });
});
