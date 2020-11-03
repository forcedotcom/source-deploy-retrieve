/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection } from '@salesforce/core';
import { fail } from 'assert';
import { expect } from 'chai';
import { join } from 'path';
import { stub } from 'sinon';
import {
  VirtualDirectory,
  VirtualTreeContainer,
  MetadataPackage,
  MetadataResolver,
  SourceComponent,
} from '../../src';
import { MetadataApi } from '../../src/client/metadataApi';
import {
  DeployStatus,
  RetrieveStatus,
  SourceDeployResult,
  SourceRetrieveResult,
} from '../../src/client/types';
import { MetadataPackageError } from '../../src/errors';
import { nls } from '../../src/i18n';
import { VirtualFile } from '../../src/metadata-registry/types';
import { mockRegistry, mockRegistryData } from '../mock/registry';

const packageXml: VirtualFile = {
  name: 'package.xml',
  data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>a</members>
        <name>DecomposedTopLevel</name>
    </types>
    <types>
        <members>b</members>
        <name>MixedContentSingleFile</name>
    </types>
    <version>${mockRegistry.apiVersion}</version>
</Package>\n`),
};

const packageXmlComplete: VirtualFile = {
  name: 'package.xml',
  data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>a</members>
        <name>DecomposedTopLevel</name>
    </types>
    <types>
        <members>b</members>
        <members>c</members>
        <name>MixedContentSingleFile</name>
    </types>
    <version>${mockRegistry.apiVersion}</version>
</Package>\n`),
};

const virtualPackageFiles: VirtualDirectory[] = [
  {
    dirPath: '.',
    children: ['decomposedTopLevels', 'mixedSingleFiles', packageXml],
  },
  {
    dirPath: 'decomposedTopLevels',
    children: ['a'],
  },
  {
    dirPath: join('decomposedTopLevels', 'a'),
    children: ['a.dtl-meta.xml', 'child1.g-meta.xml', 'child2.g-meta.xml'],
  },
  {
    dirPath: 'mixedSingleFiles',
    children: ['b.foo', 'b.mixedSingleFile-meta.xml', 'c.bar', 'c.mixedSingleFile-meta.xml'],
  },
];

const tree = new VirtualTreeContainer(virtualPackageFiles);

describe('MetadataPackage', () => {
  describe('Initializers', () => {
    describe('fromSource', () => {
      it('should initialize with source backed components', () => {
        const mdp = MetadataPackage.fromSource('.', { registry: mockRegistry, tree });
        const expected = new MetadataResolver(mockRegistry, tree).getComponentsFromPath('.');
        expect(mdp.components.getAll()).to.deep.equal(expected);
      });
    });

    describe('fromManifestFile', () => {
      it('should not initialize with source backed components by default', async () => {
        const mdp = await MetadataPackage.fromManifestFile('package.xml', {
          registry: mockRegistry,
          tree,
        });
        for (const component of mdp.components.iter()) {
          expect(component instanceof SourceComponent).to.be.false;
        }
      });

      it('should initialize with source backed components when specifying resolve option', async () => {
        const mdp = await MetadataPackage.fromManifestFile('package.xml', {
          registry: mockRegistry,
          tree,
          resolve: '.',
        });

        const expected = new MetadataResolver(mockRegistry, tree).getComponentsFromPath('.');
        const missingIndex = expected.findIndex((c) => c.fullName === 'c');
        expected.splice(missingIndex, 1);

        expect(mdp.components.getAll()).to.deep.equal(expected);
      });
    });

    describe('fromMembers', () => {
      it('should initialize non-source backed components from members', () => {
        const mdp = MetadataPackage.fromMembers(
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
          { registry: mockRegistry }
        );

        expect(mdp.components.getAll()).to.deep.equal([
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
      const mdp = MetadataPackage.fromSource('.', { registry: mockRegistry, tree });
      expect(mdp.getObject()).to.deep.equal({
        Package: {
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
  });

  describe('resolveSourceComponents', () => {
    it('should resolve components and filter', async () => {
      const mdp = new MetadataPackage(mockRegistry);
      const filter = [{ fullName: 'b', type: mockRegistryData.types.mixedcontentsinglefile }];

      const expected = new MetadataResolver(mockRegistry, tree).getComponentsFromPath('.');
      expected.splice(
        expected.findIndex((c) => c.fullName === 'a'),
        1
      );
      expected.splice(
        expected.findIndex((c) => c.fullName === 'c'),
        1
      );

      const result = mdp.resolveSourceComponents('.', { tree, filter });

      expect(result.getAll()).to.deep.equal(expected);
      expect(mdp.components.getAll()).to.deep.equal(expected);
    });

    it('should only resolve child components when present in filter even if parent source exists', () => {
      const filter = [
        {
          fullName: 'a.child1',
          type: mockRegistryData.types.decomposedtoplevel.children.types.g,
        },
        {
          fullName: 'a.child2',
          type: mockRegistryData.types.decomposedtoplevel.children.types.g,
        },
      ];
      const mdp = new MetadataPackage(mockRegistry);
      const result = mdp.resolveSourceComponents('.', { tree, filter }).getAll();
      const expected = new MetadataResolver(mockRegistry, tree)
        .getComponentsFromPath('decomposedTopLevels')[0]
        .getChildren();

      expect(result).to.deep.equal(expected);
    });
  });

  describe('getPackageXml', () => {
    it('should return manifest string when initialized from manifest file', async () => {
      const mdp = await MetadataPackage.fromManifestFile('package.xml', {
        registry: mockRegistry,
        tree,
      });

      expect(mdp.getPackageXml()).to.equal(packageXml.data.toString());
    });

    it('should return manifest string when initialized from source', () => {
      const mdp = MetadataPackage.fromSource('.', { registry: mockRegistry, tree });
      expect(mdp.getPackageXml(4)).to.equal(packageXmlComplete.data.toString());
    });
  });

  describe('deploy', () => {
    const mockResult: SourceDeployResult = {
      id: '1234',
      status: DeployStatus.Succeeded,
      success: true,
      components: [],
    };

    it('should deploy package components when given a connection', async () => {
      const mockConnection = await Connection.create({
        authInfo: await AuthInfo.create({
          username: 'test@foobar.com',
        }),
      });
      const mdp = MetadataPackage.fromSource('.', { registry: mockRegistry, tree });
      const deployStub = stub(MetadataApi.prototype, 'deploy');
      deployStub.withArgs(mdp.components.getAll() as SourceComponent[]).resolves(mockResult);

      const result = await mdp.deploy(mockConnection);

      expect(result).to.deep.equal(mockResult);

      deployStub.restore();
    });

    it('should throw error if there are no source backed components when deploying', async () => {
      const mdp = await MetadataPackage.fromManifestFile('package.xml', {
        registry: mockRegistry,
        tree,
      });

      try {
        await mdp.deploy('test@foobar.com');
        fail('should have thrown an error');
      } catch (e) {
        expect(e.name).to.equal(MetadataPackageError.name);
        expect(e.message).to.equal(nls.localize('error_no_source_to_deploy'));
      }
    });
  });

  describe('retrieve', () => {
    const mockResult: SourceRetrieveResult = {
      id: '1234',
      status: RetrieveStatus.Succeeded,
      success: true,
      components: [],
    };

    it('should retrieve package components', async () => {
      const mockConnection = await Connection.create({
        authInfo: await AuthInfo.create({
          username: 'test@foobar.com',
        }),
      });
      const mdp = MetadataPackage.fromSource('.', { registry: mockRegistry, tree });
      const retrieveStub = stub(MetadataApi.prototype, 'retrieve');
      retrieveStub
        .withArgs({
          components: mdp.components.getAll() as SourceComponent[],
          merge: true,
          output: '/test/path',
          wait: 5000,
        })
        .resolves(mockResult);

      const result = await mdp.retrieve(mockConnection, {
        merge: true,
        output: '/test/path',
        wait: 5000,
      });

      expect(result).to.deep.equal(mockResult);

      retrieveStub.restore();
    });

    it('should throw error if there are no components when retrieving', async () => {
      const mdp = new MetadataPackage(mockRegistry);
      try {
        await mdp.retrieve('test@foobar.com');
        fail('should have thrown an error');
      } catch (e) {
        expect(e.name).to.equal(MetadataPackageError.name);
        expect(e.message).to.equal(nls.localize('error_no_source_to_retrieve'));
      }
    });
  });

  describe('add', () => {
    it('should add metadata member to package components', async () => {
      const mdp = new MetadataPackage(mockRegistry);

      expect(mdp.components.size).to.equal(0);

      mdp.add({ fullName: 'foo', type: 'DecomposedTopLevel' });

      expect(mdp.components.getAll()).to.deep.equal([
        {
          fullName: 'foo',
          type: mockRegistryData.types.decomposedtoplevel,
        },
      ]);
    });

    it('should add metadata component to package components', async () => {
      const mdp = new MetadataPackage(mockRegistry);
      const component = { fullName: 'bar', type: mockRegistryData.types.mixedcontentsinglefile };

      expect(mdp.components.size).to.equal(0);

      mdp.add(component);

      expect(mdp.components.getAll()).to.deep.equal([component]);
    });
  });
});
