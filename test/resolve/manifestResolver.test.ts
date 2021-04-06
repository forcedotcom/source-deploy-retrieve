/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { createSandbox } from 'sinon';
import { MetadataComponent, RegistryAccess } from '../../src';
import { ManifestResolver, NodeFSTreeContainer } from '../../src/resolve';
import { mockRegistry, mockRegistryData } from '../mock/registry';
import * as mockManifests from '../mock/registry/manifestConstants';

const env = createSandbox();

describe('ManifestResolver', () => {
  afterEach(() => env.restore());

  describe('resolve', () => {
    it('should use expected default dependencies', async () => {
      const readFileStub = env.stub(NodeFSTreeContainer.prototype, 'readFile');
      const getTypeStub = env.stub(RegistryAccess.prototype, 'getTypeByName');
      readFileStub.resolves(mockManifests.ONE_FOLDER_MEMBER.data);
      getTypeStub.returns(mockRegistryData.types.mciffolder);

      const resolver = new ManifestResolver();
      const result = await resolver.resolve(mockManifests.ONE_FOLDER_MEMBER.name);
      const expected: MetadataComponent[] = [
        {
          fullName: 'Test_Folder',
          type: mockRegistryData.types.mciffolder,
        },
      ];

      expect(readFileStub.callCount).to.equal(1);
      expect(getTypeStub.callCount).to.equal(1);
      expect(result.components).to.deep.equal(expected);
    });

    it('should resolve components and api version in a manifest file', async () => {
      const resolver = new ManifestResolver(mockManifests.TREE, mockRegistry);

      const result = await resolver.resolve(mockManifests.BASIC.name);
      const expected: MetadataComponent[] = [
        {
          fullName: 'a',
          type: mockRegistryData.types.decomposedtoplevel,
        },
        {
          fullName: 'b',
          type: mockRegistryData.types.mixedcontentsinglefile,
        },
        {
          fullName: 'c',
          type: mockRegistryData.types.mixedcontentsinglefile,
        },
      ];

      expect(result.components).to.deep.equal(expected);
      expect(result.apiVersion).to.equal(mockRegistryData.apiVersion);
    });

    it('should interpret a member of a type in folders with no delimiter as its corresponding folder type', async () => {
      const resolver = new ManifestResolver(mockManifests.TREE, mockRegistry);

      const result = await resolver.resolve(mockManifests.ONE_FOLDER_MEMBER.name);
      const expected: MetadataComponent[] = [
        {
          fullName: 'Test_Folder',
          type: mockRegistryData.types.mciffolder,
        },
      ];

      expect(result.components).to.deep.equal(expected);
    });
  });
});
