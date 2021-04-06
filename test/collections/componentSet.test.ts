/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { testSetup } from '@salesforce/core/lib/testSetup';
import { fail } from 'assert';
import { expect } from 'chai';
import { join } from 'path';
import { createSandbox, SinonStub } from 'sinon';
import {
  ComponentSet,
  MetadataApiDeploy,
  MetadataApiRetrieve,
  MetadataComponent,
  MetadataResolver,
  RegistryAccess,
} from '../../src';
import { ComponentSetError } from '../../src/errors';
import { nls } from '../../src/i18n';
import { ManifestResolver, MetadataMember } from '../../src/resolve';
import { mockConnection } from '../mock/client';
import {
  mockRegistry,
  mockRegistryData,
  mixedContentSingleFile,
  decomposedtoplevel,
  matchingContentFile,
} from '../mock/registry';
import * as manifestFiles from '../mock/registry/manifestConstants';

const env = createSandbox();
const $$ = testSetup(env);

describe('ComponentSet', () => {
  afterEach(() => env.restore());

  describe('Initializers', () => {
    describe('fromSource', () => {
      const resolved = [matchingContentFile.COMPONENT];

      let getComponentsStub: SinonStub;

      beforeEach(() => {
        getComponentsStub = env
          .stub(MetadataResolver.prototype, 'getComponentsFromPath')
          .returns(resolved);
      });

      it('should initialize with result from source resolver', () => {
        const result = ComponentSet.fromSource('.').toArray();
        const expected = new MetadataResolver(
          mockRegistry,
          manifestFiles.TREE
        ).getComponentsFromPath('.');

        expect(result).to.deep.equal(expected);
      });

      it('should initialize with source backed components using a single file path', () => {
        const result = ComponentSet.fromSource('.').toArray();

        expect(getComponentsStub.callCount).to.equal(1);
        expect(getComponentsStub.firstCall.args[0]).to.equal('.');
        expect(result).to.deep.equal(resolved);
      });

      it('should initialize with source backed components using multiple file paths', () => {
        const paths = ['folder1', 'folder2'];

        const result = ComponentSet.fromSource(paths).toArray();

        expect(getComponentsStub.callCount).to.equal(2);
        expect(getComponentsStub.firstCall.args[0]).to.equal(paths[0]);
        expect(getComponentsStub.secondCall.args[0]).to.equal(paths[1]);
        expect(result).to.deep.equal(resolved);
      });

      it('should initialize with source backed components using options object', () => {
        getComponentsStub.restore();

        const result = ComponentSet.fromSource({
          fsPaths: ['mixedSingleFiles'],
          registry: mockRegistry,
          tree: manifestFiles.TREE,
        }).toArray();
        const expected = new MetadataResolver(
          mockRegistry,
          manifestFiles.TREE
        ).getComponentsFromPath('mixedSingleFiles');

        expect(result).to.deep.equal(expected);
      });
    });

    describe('fromManifest', () => {
      it('should initialize with components using a path', async () => {
        const expected: MetadataComponent[] = [
          {
            fullName: 'Test',
            type: mockRegistryData.types.matchingcontentfile,
          },
        ];
        const resolveStub = env.stub(ManifestResolver.prototype, 'resolve').resolves({
          components: expected,
          apiVersion: mockRegistryData.apiVersion,
        });
        env
          .stub(RegistryAccess.prototype, 'getTypeByName')
          .returns(mockRegistryData.types.matchingcontentfile);
        const manifest = manifestFiles.ONE_FOLDER_MEMBER;
        const set = await ComponentSet.fromManifest(manifest.name);

        const result = set.toArray();

        expect(resolveStub.callCount).to.equal(1);
        expect(result).to.deep.equal(expected);
      });

      it('should initialize with components using an options object', async () => {
        const manifest = manifestFiles.ONE_OF_EACH;
        const set = await ComponentSet.fromManifest({
          manifestPath: manifest.name,
          registry: mockRegistry,
          tree: manifestFiles.TREE,
        });

        const result = set.toArray();
        const expected = await new ManifestResolver(manifestFiles.TREE, mockRegistry).resolve(
          manifest.name
        );

        expect(result).to.deep.equal(expected.components);
      });

      it('should initialize with source backed components when specifying resolvePaths option', async () => {
        const set = await ComponentSet.fromManifest({
          manifestPath: manifestFiles.ONE_OF_EACH.name,
          registry: mockRegistry,
          tree: manifestFiles.TREE,
          resolveSourcePaths: ['decomposedTopLevels', 'mixedSingleFiles'],
        });

        const result = set.toArray();
        const expected = new MetadataResolver(
          mockRegistry,
          manifestFiles.TREE
        ).getComponentsFromPath('.');
        const missingIndex = expected.findIndex((c) => c.fullName === 'c');
        expected.splice(missingIndex, 1);

        expect(result).to.deep.equal(expected);
      });

      it('should resolve wildcard members by default', async () => {
        const set = await ComponentSet.fromManifest({
          manifestPath: manifestFiles.ONE_WILDCARD.name,
          registry: mockRegistry,
          tree: manifestFiles.TREE,
        });

        const result = set.has({ fullName: '*', type: 'MixedContentSingleFile' });

        expect(result).to.be.true;
      });

      it('should resolve wildcard members when forceAddWildcards = true', async () => {
        const set = await ComponentSet.fromManifest({
          manifestPath: manifestFiles.ONE_WILDCARD.name,
          registry: mockRegistry,
          tree: manifestFiles.TREE,
          forceAddWildcards: true,
        });

        const result = set.has({ fullName: '*', type: 'MixedContentSingleFile' });

        expect(result).to.be.true;
      });

      it('should resolve components and not wildcard members when forceAddWildcards = false', async () => {
        const set = await ComponentSet.fromManifest({
          manifestPath: manifestFiles.ONE_WILDCARD.name,
          registry: mockRegistry,
          tree: manifestFiles.TREE,
          resolveSourcePaths: ['.'],
          forceAddWildcards: false,
        });

        const result = set.toArray();
        const expected = new MetadataResolver(
          mockRegistry,
          manifestFiles.TREE
        ).getComponentsFromPath('mixedSingleFiles');

        expect(result).to.deep.equal(expected);
      });

      it('should resolve source and wildcard components when forceAddWildcards = true and resolvePaths are specified', async () => {
        const set = await ComponentSet.fromManifest({
          manifestPath: manifestFiles.ONE_WILDCARD.name,
          registry: mockRegistry,
          tree: manifestFiles.TREE,
          resolveSourcePaths: ['.'],
          forceAddWildcards: true,
        });
        const sourceComponents = new MetadataResolver(
          mockRegistry,
          manifestFiles.TREE
        ).getComponentsFromPath('mixedSingleFiles');

        const result = set.toArray();
        const expected = [
          { fullName: '*', type: mockRegistryData.types.mixedcontentsinglefile },
          ...sourceComponents,
        ];

        expect(result).to.deep.equal(expected);
      });

      it('should add components even if they were not resolved', async () => {
        const set = await ComponentSet.fromManifest({
          manifestPath: manifestFiles.ONE_FOLDER_MEMBER.name,
          registry: mockRegistry,
          tree: manifestFiles.TREE,
          resolveSourcePaths: ['.'],
        });

        const result = set.toArray();
        const expected = [
          {
            fullName: 'Test_Folder',
            type: mockRegistryData.types.mciffolder,
          },
        ];

        expect(result).to.deep.equal(expected);
      });
    });

    describe('constructor', () => {
      it('should initialize non-source backed components from members', () => {
        const set = new ComponentSet(
          [
            {
              fullName: 'Test1',
              type: 'DecomposedTopLevel',
            },
            {
              fullName: 'Test2',
              type: 'MixedContentSingleFile',
            },
          ],
          mockRegistry
        );

        expect(Array.from(set)).to.deep.equal([
          {
            fullName: 'Test1',
            type: mockRegistryData.types.decomposedtoplevel,
          },
          {
            fullName: 'Test2',
            type: mockRegistryData.types.mixedcontentsinglefile,
          },
        ]);
      });
    });
  });

  describe('getObject', () => {
    it('should return an object representing the package manifest', () => {
      const set = ComponentSet.fromSource({
        fsPaths: ['.'],
        registry: mockRegistry,
        tree: manifestFiles.TREE,
      });
      expect(set.getObject()).to.deep.equal({
        Package: {
          fullName: undefined,
          types: [
            {
              name: 'DecomposedTopLevel',
              members: ['a'],
            },
            {
              name: 'MixedContentSingleFile',
              members: ['b', 'c'],
            },
          ],
          version: mockRegistry.apiVersion,
        },
      });
    });

    it('should return an object representing the package manifest with fullName', () => {
      const set = ComponentSet.fromSource({
        fsPaths: ['.'],
        registry: mockRegistry,
        tree: manifestFiles.TREE,
      });
      set.fullName = 'testFullName';
      expect(set.getObject()).to.deep.equal({
        Package: {
          fullName: 'testFullName',
          types: [
            {
              name: 'DecomposedTopLevel',
              members: ['a'],
            },
            {
              name: 'MixedContentSingleFile',
              members: ['b', 'c'],
            },
          ],
          version: mockRegistry.apiVersion,
        },
      });
    });

    it('should interpret folder components as members of the type they are a container for', () => {
      const member = { fullName: 'Test_Folder', type: 'McifFolder' };
      const set = new ComponentSet([member], mockRegistry);

      expect(set.has(member)).to.be.true;
      expect(set.getObject().Package.types).to.deep.equal([
        {
          name: 'MixedContentInFolder',
          members: ['Test_Folder'],
        },
      ]);
    });

    /**
     * If component set keys are incorrectly handled, child component names may not be returned properly.
     */
    it('should correctly return addressable child components', () => {
      const set = new ComponentSet([{ fullName: 'MyParent__c.Child__c', type: 'x' }], mockRegistry);

      expect(set.getObject().Package.types).to.deep.equal([
        {
          name: 'X',
          members: ['MyParent__c.Child__c'],
        },
      ]);
    });
  });

  describe('getPackageXml', () => {
    it('should return manifest string when initialized from manifest file', async () => {
      const manifest = manifestFiles.ONE_OF_EACH;
      const set = await ComponentSet.fromManifest({
        manifestPath: manifest.name,
        registry: mockRegistry,
        tree: manifestFiles.TREE,
      });

      const result = set.getPackageXml();
      const expected = manifest.data.toString();

      expect(result).to.equal(expected);
    });

    it('should return manifest string when initialized from source', () => {
      const set = ComponentSet.fromSource({
        fsPaths: ['.'],
        registry: mockRegistry,
        tree: manifestFiles.TREE,
      });
      expect(set.getPackageXml(4)).to.equal(manifestFiles.BASIC.data.toString());
    });
  });

  describe('getSourceComponents', () => {
    it('should return source-backed components in the set', () => {
      const set = ComponentSet.fromSource({
        fsPaths: ['mixedSingleFiles'],
        registry: mockRegistry,
        tree: manifestFiles.TREE,
      });
      set.add({ fullName: 'Test', type: 'decomposedtoplevel' });
      const expected = new MetadataResolver(mockRegistry, manifestFiles.TREE).getComponentsFromPath(
        'mixedSingleFiles'
      );

      expect(set.getSourceComponents().toArray()).to.deep.equal(expected);
    });

    it('should return source-backed components that match the given metadata member', () => {
      const set = ComponentSet.fromSource({
        fsPaths: ['.'],
        registry: mockRegistry,
        tree: manifestFiles.TREE,
      });
      const expected = new MetadataResolver(mockRegistry, manifestFiles.TREE).getComponentsFromPath(
        join('mixedSingleFiles', 'b.foo')
      );

      expect(set.size).to.equal(3);
      expect(
        Array.from(set.getSourceComponents({ fullName: 'b', type: 'mixedcontentsinglefile' }))
      ).to.deep.equal(expected);
    });
  });

  describe('deploy', () => {
    it('should properly construct a deploy operation', async () => {
      const connection = await mockConnection($$);
      const set = ComponentSet.fromSource({
        fsPaths: ['.'],
        registry: mockRegistry,
        tree: manifestFiles.TREE,
      });
      const operationArgs = { components: set, usernameOrConnection: connection };
      const expectedOperation = new MetadataApiDeploy(operationArgs);
      const constructorStub = env
        .stub()
        .withArgs(operationArgs)
        .callsFake(() => expectedOperation);
      Object.setPrototypeOf(MetadataApiDeploy, constructorStub);

      const result = await set.deploy({ usernameOrConnection: connection });

      expect(result).to.deep.equal(expectedOperation);
    });

    it('should properly construct a deploy operation with overridden apiVersion', async () => {
      const connection = await mockConnection($$);
      const apiVersion = '50.0';
      const set = ComponentSet.fromSource({
        fsPaths: ['.'],
        registry: mockRegistry,
        tree: manifestFiles.TREE,
      });
      set.apiVersion = apiVersion;
      const operationArgs = { components: set, usernameOrConnection: connection, apiVersion };
      const expectedOperation = new MetadataApiDeploy(operationArgs);
      const constructorStub = env
        .stub()
        .withArgs(operationArgs)
        .callsFake(() => expectedOperation);
      Object.setPrototypeOf(MetadataApiDeploy, constructorStub);

      const result = await set.deploy({ usernameOrConnection: connection });

      expect(result).to.deep.equal(expectedOperation);
    });

    it('should throw error if there are no source backed components when deploying', async () => {
      const set = await ComponentSet.fromManifest({
        manifestPath: manifestFiles.ONE_OF_EACH.name,
        registry: mockRegistry,
        tree: manifestFiles.TREE,
      });
      try {
        await set.deploy({ usernameOrConnection: 'test@foobar.com' });
        fail('should have thrown an error');
      } catch (e) {
        expect(e.name).to.equal(ComponentSetError.name);
        expect(e.message).to.equal(nls.localize('error_no_source_to_deploy'));
      }
    });
  });

  describe('retrieve', () => {
    it('should properly construct a retrieve operation', async () => {
      const connection = await mockConnection($$);
      const set = ComponentSet.fromSource({
        fsPaths: ['.'],
        registry: mockRegistry,
        tree: manifestFiles.TREE,
      });
      const operationArgs = {
        components: set,
        output: join('test', 'path'),
        usernameOrConnection: connection,
      };
      const expectedOperation = new MetadataApiRetrieve(operationArgs);
      const constructorStub = env
        .stub()
        .withArgs(operationArgs)
        .callsFake(() => expectedOperation);
      Object.setPrototypeOf(MetadataApiRetrieve, constructorStub);

      const result = await set.retrieve({
        output: operationArgs.output,
        usernameOrConnection: connection,
      });

      expect(result).to.deep.equal(expectedOperation);
    });

    it('should properly construct a retrieve operation with overridden apiVersion', async () => {
      const connection = await mockConnection($$);
      const apiVersion = '50.0';
      const set = ComponentSet.fromSource({
        fsPaths: ['.'],
        registry: mockRegistry,
        tree: manifestFiles.TREE,
      });
      set.apiVersion = apiVersion;
      const operationArgs = {
        apiVersion,
        components: set,
        output: join('test', 'path'),
        usernameOrConnection: connection,
      };
      const expectedOperation = new MetadataApiRetrieve(operationArgs);
      const constructorStub = env
        .stub()
        .withArgs(operationArgs)
        .callsFake(() => expectedOperation);
      Object.setPrototypeOf(MetadataApiRetrieve, constructorStub);

      const result = await set.retrieve({
        output: operationArgs.output,
        usernameOrConnection: connection,
      });

      expect(result).to.deep.equal(expectedOperation);
    });

    it('should properly construct a retrieve operation with packageName', async () => {
      const connection = await mockConnection($$);
      const set = new ComponentSet([]);
      const operationArgs = {
        components: set,
        output: join('test', 'path'),
        usernameOrConnection: connection,
        packageNames: ['MyPackage'],
      };
      const expectedOperation = new MetadataApiRetrieve(operationArgs);
      const constructorStub = env
        .stub()
        .withArgs(operationArgs)
        .callsFake(() => expectedOperation);
      Object.setPrototypeOf(MetadataApiRetrieve, constructorStub);

      const result = await set.retrieve({
        packageNames: ['MyPackage'],
        output: operationArgs.output,
        usernameOrConnection: connection,
      });

      expect(result).to.deep.equal(expectedOperation);
    });
  });

  describe('add', () => {
    it('should add metadata member to package components', async () => {
      const set = new ComponentSet(undefined, mockRegistry);

      expect(set.size).to.equal(0);

      set.add({ fullName: 'foo', type: 'DecomposedTopLevel' });

      expect(Array.from(set)).to.deep.equal([
        {
          fullName: 'foo',
          type: mockRegistryData.types.decomposedtoplevel,
        },
      ]);
    });

    it('should add metadata component to package components', async () => {
      const set = new ComponentSet(undefined, mockRegistry);
      const component = { fullName: 'bar', type: mockRegistryData.types.mixedcontentsinglefile };

      expect(set.size).to.equal(0);

      set.add(component);

      expect(Array.from(set)).to.deep.equal([component]);
    });
  });

  describe('has', () => {
    it('should correctly evaluate membership with MetadataMember', () => {
      const set = new ComponentSet(undefined, mockRegistry);
      const member: MetadataMember = {
        fullName: 'a',
        type: 'MixedContentSingleFile',
      };

      expect(set.has(member)).to.be.false;

      set.add({
        fullName: 'a',
        type: mockRegistryData.types.mixedcontentsinglefile,
      });

      expect(set.has(member)).to.be.true;
    });

    it('should correctly evaluate membership with MetadataComponent', () => {
      const set = new ComponentSet(undefined, mockRegistry);
      const component: MetadataComponent = {
        fullName: 'a',
        type: mockRegistryData.types.mixedcontentsinglefile,
      };

      expect(set.has(component)).to.be.false;

      set.add({
        fullName: 'a',
        type: 'MixedContentSingleFile',
      });

      expect(set.has(component)).to.be.true;
    });

    it('should correctly evaluate membership of component with wildcard of component type in set', () => {
      const component = mixedContentSingleFile.COMPONENT;
      const set = new ComponentSet(undefined, mockRegistry);

      expect(set.has(component)).to.be.false;

      set.add({ fullName: ComponentSet.WILDCARD, type: component.type });

      expect(set.has(component)).to.be.true;
    });

    it('should correctly evaluate membership of component with parent in set', () => {
      const parent = decomposedtoplevel.DECOMPOSED_TOP_LEVEL_COMPONENT;
      const [child] = parent.getChildren();
      const set = new ComponentSet(undefined, mockRegistry);

      expect(set.has(child)).to.be.false;

      set.add(parent);

      expect(set.has(child)).to.be.true;
    });

    it('should correctly evaluate membership of component with wildcard of parent type in set', () => {
      const parent = decomposedtoplevel.DECOMPOSED_TOP_LEVEL_COMPONENT;
      const [child] = parent.getChildren();
      const set = new ComponentSet(undefined, mockRegistry);

      expect(set.has(child)).to.be.false;

      set.add({ fullName: ComponentSet.WILDCARD, type: parent.type });

      expect(set.has(child)).to.be.true;
    });
  });

  it('should calculate size correctly', () => {
    const set = ComponentSet.fromSource({
      fsPaths: ['.'],
      registry: mockRegistry,
      tree: manifestFiles.TREE,
    });

    expect(set.size).to.equal(3);
  });
});
