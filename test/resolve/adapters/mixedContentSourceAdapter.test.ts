/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'node:path';
import { assert, expect, config } from 'chai';
import fs from 'graceful-fs';
import { Messages, SfError } from '@salesforce/core';
import { createSandbox } from 'sinon';
import { ensureString } from '@salesforce/ts-types';
import { getMixedContentComponent } from '../../../src/resolve/adapters/mixedContentSourceAdapter';
import { ForceIgnore, registry, RegistryAccess, SourceComponent, VirtualTreeContainer } from '../../../src';
import {
  MIXED_CONTENT_DIRECTORY_CONTENT_PATH,
  MIXED_CONTENT_DIRECTORY_VIRTUAL_FS_NO_XML,
} from '../../mock/type-constants/staticresourceConstant';
import { mixedContentDirectory, mixedContentSingleFile } from '../../mock';

const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');
config.truncateThreshold = 0;

describe('MixedContentSourceAdapter', () => {
  const registryAccess = new RegistryAccess();

  describe('static resource', () => {
    const env = createSandbox();
    const type = registry.types.staticresource;

    it('Should throw ExpectedSourceFilesError if content does not exist', () => {
      const tree = new VirtualTreeContainer([
        {
          dirPath: mixedContentSingleFile.TYPE_DIRECTORY,
          children: [mixedContentSingleFile.XML_NAMES[0]],
        },
      ]);
      const adapter = getMixedContentComponent({ registry: registryAccess, tree });
      assert.throws(
        () => adapter({ path: ensureString(mixedContentSingleFile.COMPONENT.content), type }),
        SfError,
        messages.getMessage('error_expected_source_files', [mixedContentSingleFile.CONTENT_PATHS[0], type.name])
      );
    });

    it('Should throw ExpectedSourceFilesError if ALL folder content is forceignored', () => {
      const forceIgnorePath = join('mcsa', ForceIgnore.FILE_NAME);
      const readStub = env.stub(fs, 'readFileSync');
      readStub.withArgs(forceIgnorePath).returns(mixedContentDirectory.MIXED_CONTENT_DIRECTORY_SOURCE_PATHS.join('\n'));

      const tree = new VirtualTreeContainer(mixedContentDirectory.MIXED_CONTENT_DIRECTORY_VIRTUAL_FS);
      const adapter = getMixedContentComponent({
        registry: registryAccess,
        tree,
        forceIgnore: new ForceIgnore(forceIgnorePath),
      });

      env.restore();
      const path = mixedContentDirectory.MIXED_CONTENT_DIRECTORY_SOURCE_PATHS[0];
      assert.throws(
        () => adapter({ type, path }),
        SfError,
        messages.getMessage('error_expected_source_files', [
          mixedContentDirectory.MIXED_CONTENT_DIRECTORY_SOURCE_PATHS[0],
          type.name,
        ])
      );
    });
  });

  describe('File Content', () => {
    const type = registry.types.staticresource;
    const component = mixedContentSingleFile.COMPONENT;
    const adapter = getMixedContentComponent({ registry: registryAccess, tree: component.tree });

    it('Should return expected SourceComponent when given a root metadata xml path', () => {
      const result = adapter({ type, path: ensureString(component.xml) });
      expect(result).to.deep.equal(component);
    });

    it('Should return expected SourceComponent when given a source path', () => {
      const result = adapter({ type, path: ensureString(component.content) });
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
    const adapter = getMixedContentComponent({ registry: registryAccess, tree });
    const expectedComponent = new SourceComponent(MIXED_CONTENT_DIRECTORY_COMPONENT, tree);

    it('Should return expected SourceComponent when given a root metadata xml path', () => {
      expect(adapter({ path: MIXED_CONTENT_DIRECTORY_XML_PATHS[0], type })).to.deep.equal(expectedComponent);
    });

    it('Should return expected SourceComponent when given a source path', () => {
      MIXED_CONTENT_DIRECTORY_SOURCE_PATHS.map((path) => {
        expect(adapter({ path, type })).to.deep.equal(expectedComponent);
      });
    });

    // TODO: why is this a valid use case?  What Mixed Content type would work without a meta xml ?
    it.skip('should return expected SourceComponent when there is no metadata xml', () => {
      const tree = new VirtualTreeContainer(MIXED_CONTENT_DIRECTORY_VIRTUAL_FS_NO_XML);
      const adapter = getMixedContentComponent({ registry: registryAccess, tree });
      const expectedComponent = new SourceComponent(
        {
          name: 'aStaticResource',
          type,
          content: MIXED_CONTENT_DIRECTORY_CONTENT_PATH,
        },
        tree
      );
      expect(adapter({ type, path: mixedContentDirectory.MIXED_CONTENT_DIRECTORY_CONTENT_PATH })).to.deep.equal(
        expectedComponent
      );
    });
  });
});
