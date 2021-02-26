/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { testSetup } from '@salesforce/core/lib/testSetup';
import { fail } from 'assert';
import { expect } from 'chai';
import { join } from 'path';
import { createSandbox } from 'sinon';
import { VirtualDirectory, VirtualTreeContainer, ComponentSet, MetadataResolver } from '../../src';
import { MetadataApiDeploy, MetadataApiRetrieve } from '../../src/client';
import { MetadataComponent, MetadataMember } from '../../src/common/types';
import { ComponentSetError } from '../../src/errors';
import { nls } from '../../src/i18n';
import { VirtualFile } from '../../src/metadata-registry/types';
import { mockConnection } from '../mock/client';
import { mockRegistry, mockRegistryData } from '../mock/registry';

const env = createSandbox();
const $$ = testSetup(env);

const subsetXml: VirtualFile = {
  name: 'subset.xml',
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

const completeXml: VirtualFile = {
  name: 'complete.xml',
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

const wildcardXml: VirtualFile = {
  name: 'wildcard.xml',
  data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>*</members>
        <name>MixedContentSingleFile</name>
    </types>
    <version>${mockRegistry.apiVersion}</version>
</Package>\n`),
};

const singleMemberXml: VirtualFile = {
  name: 'singleMember.xml',
  data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>Test</members>
        <name>MixedContentSingleFile</name>
    </types>
    <version>${mockRegistry.apiVersion}</version>
</Package>\n`),
};

const folderComponentXml: VirtualFile = {
  name: 'folderComponent.xml',
  data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>Test_Folder</members>
        <name>MixedContentInFolder</name>
    </types>
    <version>${mockRegistry.apiVersion}</version>
</Package>\n`),
};

const virtualPackageFiles: VirtualDirectory[] = [
  {
    dirPath: '.',
    children: [
      'decomposedTopLevels',
      'mixedSingleFiles',
      subsetXml,
      wildcardXml,
      singleMemberXml,
      folderComponentXml,
    ],
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

describe('ComponentSet', () => {
  afterEach(() => env.restore());

  describe('Initializers', () => {
    describe('fromSource', () => {
      it('should initialize with source backed components', () => {
        const set = ComponentSet.fromSource('.', { registry: mockRegistry, tree });
        const expected = new MetadataResolver(mockRegistry, tree).getComponentsFromPath('.');
        expect(Array.from(set)).to.deep.equal(expected);
      });
    });

    describe('fromManifestFile', () => {
      it('should not initialize with source backed components by default', async () => {
        const set = await ComponentSet.fromManifestFile('subset.xml', {
          registry: mockRegistry,
          tree,
        });
        expect(Array.from(set)).to.deep.equal([
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

      /**
       * xml parsing library returns string | string[] for entries, tests that this is handled
       */
      it('should handle types with one member properly', async () => {
        const set = await ComponentSet.fromManifestFile('singleMember.xml', {
          registry: mockRegistry,
          tree,
        });
        expect(Array.from(set)).to.deep.equal([
          {
            fullName: 'Test',
            type: mockRegistryData.types.mixedcontentsinglefile,
          },
        ]);
      });

      it('should interpret a member of a type in folders with no delimiter as its corresponding folder type', async () => {
        const set = await ComponentSet.fromManifestFile('folderComponent.xml', {
          registry: mockRegistry,
          tree,
        });
        expect(Array.from(set)).to.deep.equal([
          {
            fullName: 'Test_Folder',
            type: mockRegistryData.types.mciffolder,
          },
        ]);
      });

      it('should initialize with source backed components when specifying string resolve option', async () => {
        const set = await ComponentSet.fromManifestFile('subset.xml', {
          registry: mockRegistry,
          tree,
          resolve: '.',
        });

        const expected = new MetadataResolver(mockRegistry, tree).getComponentsFromPath('.');
        const missingIndex = expected.findIndex((c) => c.fullName === 'c');
        expected.splice(missingIndex, 1);

        expect(Array.from(set)).to.deep.equal(expected);
      });

      it('should initialize with source backed components when specifying non-string iterable resolve option', async () => {
        const set = await ComponentSet.fromManifestFile('subset.xml', {
          registry: mockRegistry,
          tree,
          resolve: ['decomposedTopLevels', 'mixedSingleFiles'],
        });

        const expected = new MetadataResolver(mockRegistry, tree).getComponentsFromPath('.');
        const missingIndex = expected.findIndex((c) => c.fullName === 'c');
        expected.splice(missingIndex, 1);

        expect(Array.from(set)).to.deep.equal(expected);
      });

      it('should interpret wildcard members literally by default', async () => {
        const set = await ComponentSet.fromManifestFile('wildcard.xml', {
          registry: mockRegistry,
          tree,
        });

        expect(set.has({ fullName: '*', type: 'MixedContentSingleFile' })).to.be.true;
      });

      it('should interpret wildcard members literally when literalWildcard = true', async () => {
        const set = await ComponentSet.fromManifestFile('wildcard.xml', {
          registry: mockRegistry,
          tree,
          literalWildcard: true,
        });

        expect(set.has({ fullName: '*', type: 'MixedContentSingleFile' }));
      });

      it('should resolve components when literalWildcard = false and wildcard is encountered', async () => {
        const set = await ComponentSet.fromManifestFile('wildcard.xml', {
          registry: mockRegistry,
          tree,
          resolve: '.',
          literalWildcard: false,
        });
        const expected = new MetadataResolver(mockRegistry, tree).getComponentsFromPath(
          'mixedSingleFiles'
        );

        expect(Array.from(set)).to.deep.equal(expected);
      });

      it('should resolve components and add literal wildcard component when literalWildcard = true and resolve != undefined', async () => {
        const set = await ComponentSet.fromManifestFile('wildcard.xml', {
          registry: mockRegistry,
          tree,
          resolve: '.',
          literalWildcard: true,
        });
        const sourceComponents = new MetadataResolver(mockRegistry, tree).getComponentsFromPath(
          'mixedSingleFiles'
        );

        expect(Array.from(set)).to.deep.equal([
          { fullName: '*', type: mockRegistryData.types.mixedcontentsinglefile },
          ...sourceComponents,
        ]);

        it('should add components even if they were not resolved', async () => {
          const set = await ComponentSet.fromManifestFile('folderComponent.xml', {
            registry: mockRegistry,
            tree,
            resolve: '.',
          });

          expect(Array.from(set)).to.deep.equal([
            {
              fullName: 'Test_Folder',
              type: mockRegistryData.types.mciffolder,
            },
          ]);
        });
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
      const set = ComponentSet.fromSource('.', { registry: mockRegistry, tree });
      expect(set.getObject()).to.deep.equal({
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

  describe('resolveSourceComponents', () => {
    it('should resolve components and add to package', () => {
      const set = new ComponentSet(undefined, mockRegistry);
      const expected = new MetadataResolver(mockRegistry, tree).getComponentsFromPath('.');
      const result = set.resolveSourceComponents('.', { tree });

      expect(Array.from(result)).to.deep.equal(expected);
      expect(Array.from(set)).to.deep.equal(expected);
    });
  });

  describe('getPackageXml', () => {
    it('should return manifest string when initialized from manifest file', async () => {
      const set = await ComponentSet.fromManifestFile('subset.xml', {
        registry: mockRegistry,
        tree,
      });

      expect(set.getPackageXml()).to.equal(subsetXml.data.toString());
    });

    it('should return manifest string when initialized from source', () => {
      const set = ComponentSet.fromSource('.', { registry: mockRegistry, tree });
      expect(set.getPackageXml(4)).to.equal(completeXml.data.toString());
    });
  });

  describe('getSourceComponents', () => {
    it('should return source-backed components in the set', () => {
      const set = ComponentSet.fromSource('mixedSingleFiles', { registry: mockRegistry, tree });
      set.add({ fullName: 'Test', type: 'decomposedtoplevel' });
      const expected = new MetadataResolver(mockRegistry, tree).getComponentsFromPath(
        'mixedSingleFiles'
      );

      expect(Array.from(set.getSourceComponents())).to.deep.equal(expected);
    });

    it('should return source-backed components that match the given metadata member', () => {
      const set = ComponentSet.fromSource('.', { registry: mockRegistry, tree });
      const expected = new MetadataResolver(mockRegistry, tree).getComponentsFromPath(
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
      const set = ComponentSet.fromSource('.', { registry: mockRegistry, tree });
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

    it('should throw error if there are no source backed components when deploying', async () => {
      const set = await ComponentSet.fromManifestFile('subset.xml', {
        registry: mockRegistry,
        tree,
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
      const set = ComponentSet.fromSource('.', { registry: mockRegistry, tree });
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

    it('should throw error if there are no components in the set', async () => {
      const set = new ComponentSet(undefined, mockRegistry);
      try {
        await set.retrieve({ usernameOrConnection: 'test@foobar.com', output: 'test' });
        fail('should have thrown an error');
      } catch (e) {
        expect(e.name).to.equal(ComponentSetError.name);
        expect(e.message).to.equal(nls.localize('error_no_components_to_retrieve'));
      }
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
    it('should correctly identify membership when given a MetadataMember', () => {
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

    it('should correctly identify membership when given a MetadataComponent', () => {
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
  });

  it('should calculate size correctly', () => {
    const set = ComponentSet.fromSource('.', { registry: mockRegistry, tree });

    expect(set.size).to.equal(3);
  });
});
