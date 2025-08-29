/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { join } from 'node:path';
import { assert, expect } from 'chai';
import fs from 'graceful-fs';
import { Messages, SfError } from '@salesforce/core';
import { createSandbox } from 'sinon';
import { ensureString } from '@salesforce/ts-types';
import { MixedContentSourceAdapter } from '../../../src/resolve/adapters';
import { ForceIgnore, registry, RegistryAccess, SourceComponent, VirtualTreeContainer } from '../../../src';
import {
  MIXED_CONTENT_DIRECTORY_CONTENT_PATH,
  MIXED_CONTENT_DIRECTORY_VIRTUAL_FS_NO_XML,
} from '../../mock/type-constants/staticresourceConstant';
import { mixedContentDirectory, mixedContentSingleFile, experiencePropertyTypeContentSingleFile } from '../../mock';

const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

describe('MixedContentSourceAdapter', () => {
  const env = createSandbox();

  const registryAccess = new RegistryAccess();
  it('Should throw ExpectedSourceFilesError if content does not exist', () => {
    const type = registry.types.staticresource;
    const tree = new VirtualTreeContainer([
      {
        dirPath: mixedContentSingleFile.TYPE_DIRECTORY,
        children: [mixedContentSingleFile.XML_NAMES[0]],
      },
    ]);
    const adapter = new MixedContentSourceAdapter(type, registryAccess, undefined, tree);
    assert.throws(
      () => adapter.getComponent(ensureString(mixedContentSingleFile.COMPONENT.content)),
      SfError,
      messages.getMessage('error_expected_source_files', [mixedContentSingleFile.CONTENT_PATHS[0], type.name])
    );
  });

  it('Should throw ExpectedSourceFilesError if ALL folder content is forceignored', () => {
    const forceIgnorePath = join('mcsa', ForceIgnore.FILE_NAME);
    const readStub = env.stub(fs, 'readFileSync');
    readStub.withArgs(forceIgnorePath).returns(mixedContentDirectory.MIXED_CONTENT_DIRECTORY_SOURCE_PATHS.join('\n'));

    const type = registry.types.staticresource;
    const tree = new VirtualTreeContainer(mixedContentDirectory.MIXED_CONTENT_DIRECTORY_VIRTUAL_FS);
    const adapter = new MixedContentSourceAdapter(type, registryAccess, new ForceIgnore(forceIgnorePath), tree);
    env.restore();
    assert.throws(
      () => adapter.getComponent(ensureString(mixedContentSingleFile.COMPONENT.content)),
      SfError,
      messages.getMessage('error_expected_source_files', [mixedContentSingleFile.CONTENT_PATHS[0], type.name])
    );
  });

  describe('File Content', () => {
    const component = mixedContentSingleFile.COMPONENT;
    const adapter = new MixedContentSourceAdapter(
      registry.types.staticresource,
      registryAccess,
      undefined,
      component.tree
    );

    it('Should return expected SourceComponent when given a root metadata xml path', () => {
      assert(component.xml);
      const result = adapter.getComponent(component.xml);
      expect(result).to.deep.equal(component);
    });

    it('Should return expected SourceComponent when given a source path', () => {
      assert(component.content);
      const result = adapter.getComponent(component.content);
      expect(result).to.deep.equal(component);
    });
  });

  describe('Experience Property Type File Content', () => {
    const component = experiencePropertyTypeContentSingleFile.COMPONENT;
    const adapter = new MixedContentSourceAdapter(
      registry.types.experiencepropertytypebundle,
      registryAccess,
      undefined,
      component.tree
    );

    it('Should return expected SourceComponent when given a schema.json path', () => {
      assert(component.xml);
      const result = adapter.getComponent(component.xml);

      expect(result).to.deep.equal(component);
    });

    it('Should return expected SourceComponent when given a source path', () => {
      assert(component.content);
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
    const adapter = new MixedContentSourceAdapter(type, registryAccess, undefined, tree);
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
      const adapter = new MixedContentSourceAdapter(type, registryAccess, undefined, tree);
      const expectedComponent = new SourceComponent(
        {
          name: 'aStaticResource',
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
