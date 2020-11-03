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

  describe('getComponents', () => {
    it('should return source backed components if present', () => {
      const mdp = MetadataPackage.fromSource('.', { registry: mockRegistry, tree });
      const expected = new MetadataResolver(mockRegistry, tree).getComponentsFromPath('.');
      expect(mdp.getComponents().getAll()).to.deep.equal(expected);
    });

    it('should return non-source backed components if source components not present', async () => {
      const mdp = await MetadataPackage.fromManifestFile('package.xml', {
        registry: mockRegistry,
        tree,
      });
      expect(mdp.getComponents().getAll()).to.deep.equal([
        {
          fullName: 'a',
          type: mockRegistryData.types.decomposedtoplevel,
        },
        {
          fullName: 'b',
          type: mockRegistryData.types.mixedcontentsinglefile,
        },
      ]);
    });

    // it('should throw an error if there is no way to return components', () => {
    //   // @ts-ignore constructor is private, but we are breaking the rules to stop
    //   // initializers from breaking the rules.
    //   const badMdp = new MetadataPackage(mockRegistry);
    //   try {
    //     (badMdp as MetadataPackage).getComponents();
    //     fail('should have thrown an error');
    //   } catch (e) {
    //     expect(e.name).to.equal(MetadataPackageError.name);
    //     expect(e.message).to.equal(nls.localize('error_invalid_package'));
    //   }
    // });
  });

  describe('getSourceComponents', () => {
    it('should initialize with source backed components', () => {
      const mdp = MetadataPackage.fromSource('.', { registry: mockRegistry, tree });
      const expected = new MetadataResolver(mockRegistry, tree).getComponentsFromPath('.');
      expect(mdp.getSourceComponents().getAll()).to.deep.equal(expected);
    });

    it('should not initialize with source backed components by default', async () => {
      const mdp = await MetadataPackage.fromManifestFile('package.xml', {
        registry: mockRegistry,
        tree,
      });
      expect(mdp.getSourceComponents().size).to.equal(0);
    });

    it('should initialize with source-backed components when specifying resolve option', async () => {
      const mdp = await MetadataPackage.fromManifestFile('package.xml', {
        registry: mockRegistry,
        tree,
        resolve: '.',
      });
      const expected = new MetadataResolver(mockRegistry, tree).getComponentsFromPath('.');
      expect(mdp.getSourceComponents().getAll()).to.deep.equal(expected);
    });

    it('should force reinitializing package components with reinitialize option', () => {
      const resolver = new MetadataResolver(mockRegistry, tree);
      const mdp = MetadataPackage.fromSource('decomposedTopLevels', {
        registry: mockRegistry,
        tree,
      });

      expect(mdp.getSourceComponents().getAll()).to.deep.equal(
        resolver.getComponentsFromPath('decomposedTopLevels')
      );

      const result = mdp.getSourceComponents({ resolve: '.', tree, reinitialize: true }).getAll();
      const expected = resolver.getComponentsFromPath('.');

      expect(result).to.deep.equal(expected);
    });

    it('should resolve new components against package components', async () => {
      const mdp = await MetadataPackage.fromManifestFile('package.xml', {
        registry: mockRegistry,
        tree,
      });

      expect(mdp.getSourceComponents().size).to.equal(0);

      // since the package only includes components a and b, it should not resolve c
      const result = mdp.getSourceComponents({ resolve: '.', tree }).getAll();
      const expected = new MetadataResolver(mockRegistry, tree).getComponentsFromPath('.');
      const missingIndex = expected.findIndex((c) => c.fullName === 'c');
      expected.splice(missingIndex, 1);

      expect(result).to.deep.equal(expected);
    });

    it('should only resolve child components even if parent is present', () => {
      const mdp = MetadataPackage.fromMembers(
        [
          {
            fullName: 'a.child1',
            type: 'G',
          },
          {
            fullName: 'a.child2',
            type: 'G',
          },
        ],
        { registry: mockRegistry }
      );

      const result = mdp.getSourceComponents({ resolve: '.', tree }).getAll();
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
      deployStub.withArgs(mdp.getSourceComponents().getAll()).resolves(mockResult);

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
          components: mdp.getSourceComponents().getAll(),
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
  });

  describe('add', () => {
    it('should add metadata member to package components', async () => {
      const mdp = new MetadataPackage(mockRegistry);

      expect(mdp.getComponents().size).to.equal(0);

      mdp.add({ fullName: 'foo', type: 'DecomposedTopLevel' });

      expect(mdp.getComponents().getAll()).to.deep.equal([
        {
          fullName: 'foo',
          type: mockRegistryData.types.decomposedtoplevel,
        },
      ]);
    });

    it('should add metadata component to package components', async () => {
      const mdp = new MetadataPackage(mockRegistry);
      const component = { fullName: 'bar', type: mockRegistryData.types.mixedcontentsinglefile };

      expect(mdp.getComponents().size).to.equal(0);

      mdp.add(component);

      expect(mdp.getComponents().getAll()).to.deep.equal([component]);
    });

    it('should invalidate source component cache when adding', () => {
      const mdp = MetadataPackage.fromSource('.', { registry: mockRegistry, tree });

      expect(mdp.getComponents().size).to.equal(3);
      expect(mdp.getSourceComponents().size).to.equal(3);

      mdp.add({ fullName: 'foo', type: 'MixedContentSingleFile' });

      expect(mdp.getComponents().size).to.equal(4);
      expect(mdp.getSourceComponents().size).to.equal(0);
    });
  });
});
