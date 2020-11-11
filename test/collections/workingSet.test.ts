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
import { createSandbox, stub } from 'sinon';
import {
  VirtualDirectory,
  VirtualTreeContainer,
  WorkingSet,
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
import { MetadataComponent, MetadataMember } from '../../src/common/types';
import { WorkingSetError } from '../../src/errors';
import { nls } from '../../src/i18n';
import { VirtualFile } from '../../src/metadata-registry/types';
import { mockRegistry, mockRegistryData } from '../mock/registry';

const env = createSandbox();

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
  name: 'packageComplete.xml',
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

const packageXmlWildcard: VirtualFile = {
  name: 'packageWildcard.xml',
  data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>*</members>
        <name>MixedContentSingleFile</name>
    </types>
    <version>${mockRegistry.apiVersion}</version>
</Package>\n`),
};

const packageXmlSingleMember: VirtualFile = {
  name: 'packageSingleMember.xml',
  data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>Test</members>
        <name>MixedContentSingleFile</name>
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
      packageXml,
      packageXmlWildcard,
      packageXmlSingleMember,
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

describe('WorkingSet', () => {
  afterEach(() => env.restore());

  describe('Initializers', () => {
    describe('fromSource', () => {
      it('should initialize with source backed components', () => {
        const mdp = WorkingSet.fromSource('.', { registry: mockRegistry, tree });
        const expected = new MetadataResolver(mockRegistry, tree).getComponentsFromPath('.');
        expect(Array.from(mdp)).to.deep.equal(expected);
      });
    });

    describe('fromManifestFile', () => {
      it('should not initialize with source backed components by default', async () => {
        const mdp = await WorkingSet.fromManifestFile('package.xml', {
          registry: mockRegistry,
          tree,
        });
        expect(Array.from(mdp)).to.deep.equal([
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
        const mdp = await WorkingSet.fromManifestFile('packageSingleMember.xml', {
          registry: mockRegistry,
          tree,
        });
        expect(Array.from(mdp)).to.deep.equal([
          {
            fullName: 'Test',
            type: mockRegistryData.types.mixedcontentsinglefile,
          },
        ]);
      });

      it('should initialize with source backed components when specifying resolve option', async () => {
        const mdp = await WorkingSet.fromManifestFile('package.xml', {
          registry: mockRegistry,
          tree,
          resolve: '.',
        });

        const expected = new MetadataResolver(mockRegistry, tree).getComponentsFromPath('.');
        const missingIndex = expected.findIndex((c) => c.fullName === 'c');
        expected.splice(missingIndex, 1);

        expect(Array.from(mdp)).to.deep.equal(expected);
      });

      it('should interpret wildcard members literally by default', async () => {
        const mdp = await WorkingSet.fromManifestFile('packageWildcard.xml', {
          registry: mockRegistry,
          tree,
        });

        expect(mdp.has({ fullName: '*', type: 'MixedContentSingleFile' })).to.be.true;
      });

      it('should interpret wildcard members literally when literalWildcard = true', async () => {
        const mdp = await WorkingSet.fromManifestFile('packageWildcard.xml', {
          registry: mockRegistry,
          tree,
          literalWildcard: true,
        });

        expect(mdp.has({ fullName: '*', type: 'MixedContentSingleFile' }));
      });

      it('should resolve components when literalWildcard = false and wildcard is encountered', async () => {
        const mdp = await WorkingSet.fromManifestFile('packageWildcard.xml', {
          registry: mockRegistry,
          tree,
          resolve: '.',
          literalWildcard: false,
        });
        const expected = new MetadataResolver(mockRegistry, tree).getComponentsFromPath(
          'mixedSingleFiles'
        );

        expect(Array.from(mdp)).to.deep.equal(expected);
      });

      it('should resolve components and add literal wildcard component when literalWildcard = true and resolve != undefined', async () => {
        const mdp = await WorkingSet.fromManifestFile('packageWildcard.xml', {
          registry: mockRegistry,
          tree,
          resolve: '.',
          literalWildcard: true,
        });
        const sourceComponents = new MetadataResolver(mockRegistry, tree).getComponentsFromPath(
          'mixedSingleFiles'
        );

        expect(Array.from(mdp)).to.deep.equal([
          { fullName: '*', type: mockRegistryData.types.mixedcontentsinglefile },
          ...sourceComponents,
        ]);
      });
    });

    describe('fromComponents', () => {
      it('should initialize non-source backed components from members', () => {
        const mdp = WorkingSet.fromComponents(
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

        expect(Array.from(mdp)).to.deep.equal([
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
      const mdp = WorkingSet.fromSource('.', { registry: mockRegistry, tree });
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
    it('should resolve components and add to package', () => {
      const mdp = new WorkingSet(mockRegistry);
      const expected = new MetadataResolver(mockRegistry, tree).getComponentsFromPath('.');
      const result = mdp.resolveSourceComponents('.', { tree });

      expect(Array.from(result)).to.deep.equal(expected);
      expect(Array.from(mdp)).to.deep.equal(expected);
    });

    it('should resolve components and filter', async () => {
      const mdp = new WorkingSet(mockRegistry);
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

      expect(Array.from(result)).to.deep.equal(expected);
      expect(Array.from(mdp)).to.deep.equal(expected);
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
      const mdp = new WorkingSet(mockRegistry);
      const result = mdp.resolveSourceComponents('.', { tree, filter });
      const expected = new MetadataResolver(mockRegistry, tree)
        .getComponentsFromPath('decomposedTopLevels')[0]
        .getChildren();

      expect(Array.from(result)).to.deep.equal(expected);
      expect(Array.from(mdp)).to.deep.equal(expected);
    });
  });

  describe('getPackageXml', () => {
    it('should return manifest string when initialized from manifest file', async () => {
      const mdp = await WorkingSet.fromManifestFile('package.xml', {
        registry: mockRegistry,
        tree,
      });

      expect(mdp.getPackageXml()).to.equal(packageXml.data.toString());
    });

    it('should return manifest string when initialized from source', () => {
      const mdp = WorkingSet.fromSource('.', { registry: mockRegistry, tree });
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
      const mdp = WorkingSet.fromSource('.', { registry: mockRegistry, tree });
      const deployStub = env.stub(MetadataApi.prototype, 'deploy');
      deployStub.withArgs(Array.from(mdp) as SourceComponent[]).resolves(mockResult);

      const result = await mdp.deploy(mockConnection);

      expect(result).to.deep.equal(mockResult);
    });

    it('should warn when some components are missing source', async () => {
      stub(MetadataApi.prototype, 'deploy');
      const warnStub = env.stub(console, 'warn').callsFake(() => true);
      const mdp = WorkingSet.fromSource('.', { registry: mockRegistry, tree });
      const missing = Array.from(mdp).map((c) => `${c.type.name}:${c.fullName}`);

      mdp.add({ fullName: 'NoSource', type: 'MixedContentSingleFile' });

      await mdp.deploy('test@foobar.com');

      expect(
        warnStub.calledOnceWith(
          nls.localize('warn_unresolved_source_for_components', missing.join(','))
        )
      );
    });

    it('should throw error if there are no source backed components when deploying', async () => {
      const mdp = await WorkingSet.fromManifestFile('package.xml', {
        registry: mockRegistry,
        tree,
      });

      try {
        await mdp.deploy('test@foobar.com');
        fail('should have thrown an error');
      } catch (e) {
        expect(e.name).to.equal(WorkingSetError.name);
        expect(e.message).to.equal(nls.localize('error_no_source_to_deploy'));
      }
    });

    it('should throw error if attempting to deploy a wildcard literal component', async () => {
      const mdp = await WorkingSet.fromManifestFile('packageWildcard.xml', {
        registry: mockRegistry,
        tree,
      });

      try {
        await mdp.deploy('test@foobar.com');
        fail('should have thrown an error');
      } catch (e) {
        expect(e.name).to.equal(WorkingSetError.name);
        expect(e.message).to.equal(nls.localize('error_deploy_wildcard_literal'));
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
      const mdp = WorkingSet.fromSource('.', { registry: mockRegistry, tree });
      const retrieveStub = env.stub(MetadataApi.prototype, 'retrieve');
      retrieveStub
        .withArgs({
          components: Array.from(mdp) as SourceComponent[],
          merge: undefined,
          output: '/test/path',
          wait: undefined,
        })
        .resolves(mockResult);

      const result = await mdp.retrieve(mockConnection, '/test/path');

      expect(result).to.deep.equal(mockResult);
    });

    it('should handle options', async () => {
      const mockConnection = await Connection.create({
        authInfo: await AuthInfo.create({
          username: 'test@foobar.com',
        }),
      });
      const mdp = WorkingSet.fromSource('.', { registry: mockRegistry, tree });
      const retrieveStub = stub(MetadataApi.prototype, 'retrieve');

      await mdp.retrieve(mockConnection, '/test/path', {
        merge: true,
        wait: 1234,
      });

      expect(
        retrieveStub.calledWith({
          components: Array.from(mdp) as SourceComponent[],
          merge: true,
          output: '/test/path',
          wait: 1234,
        })
      ).to.be.true;
    });

    it('should throw error if there are no components when retrieving', async () => {
      const mdp = new WorkingSet(mockRegistry);
      try {
        await mdp.retrieve('test@foobar.com', '/test/path');
        fail('should have thrown an error');
      } catch (e) {
        expect(e.name).to.equal(WorkingSetError.name);
        expect(e.message).to.equal(nls.localize('error_no_components_to_retrieve'));
      }
    });
  });

  describe('add', () => {
    it('should add metadata member to package components', async () => {
      const mdp = new WorkingSet(mockRegistry);

      expect(mdp.size).to.equal(0);

      mdp.add({ fullName: 'foo', type: 'DecomposedTopLevel' });

      expect(Array.from(mdp)).to.deep.equal([
        {
          fullName: 'foo',
          type: mockRegistryData.types.decomposedtoplevel,
        },
      ]);
    });

    it('should add metadata component to package components', async () => {
      const mdp = new WorkingSet(mockRegistry);
      const component = { fullName: 'bar', type: mockRegistryData.types.mixedcontentsinglefile };

      expect(mdp.size).to.equal(0);

      mdp.add(component);

      expect(Array.from(mdp)).to.deep.equal([component]);
    });
  });

  describe('has', () => {
    it('should correctly identify membership when given a MetadataMember', () => {
      const ws = new WorkingSet(mockRegistry);
      const member: MetadataMember = {
        fullName: 'a',
        type: 'MixedContentSingleFile',
      };

      expect(ws.has(member)).to.be.false;

      ws.add({
        fullName: 'a',
        type: mockRegistryData.types.mixedcontentsinglefile,
      });

      expect(ws.has(member)).to.be.true;
    });

    it('should correctly identify membership when given a MetadataComponent', () => {
      const ws = new WorkingSet(mockRegistry);
      const component: MetadataComponent = {
        fullName: 'a',
        type: mockRegistryData.types.mixedcontentsinglefile,
      };

      expect(ws.has(component)).to.be.false;

      ws.add({
        fullName: 'a',
        type: 'MixedContentSingleFile',
      });

      expect(ws.has(component)).to.be.true;
    });
  });

  describe('entries', () => {
    it('should return component entries of the set by type name', () => {
      const mdp = WorkingSet.fromComponents(
        [
          {
            fullName: 'Test1',
            type: 'DecomposedTopLevel',
          },
          {
            fullName: 'Test2',
            type: 'MixedContentSingleFile',
          },
          {
            fullName: 'Test3',
            type: 'MixedContentSingleFile',
          },
        ],
        { registry: mockRegistry }
      );

      const entries = Array.from(mdp.entries());
      expect(entries.length).to.equal(2);

      const dtls = entries.find((entry) => entry[0] === 'DecomposedTopLevel')[1];
      expect(Array.from(dtls)).to.deep.equal([
        {
          fullName: 'Test1',
          type: mockRegistryData.types.decomposedtoplevel,
        },
      ]);

      const msfs = entries.find((entry) => entry[0] === 'MixedContentSingleFile')[1];
      expect(Array.from(msfs)).to.deep.equal([
        {
          fullName: 'Test2',
          type: mockRegistryData.types.mixedcontentsinglefile,
        },
        {
          fullName: 'Test3',
          type: mockRegistryData.types.mixedcontentsinglefile,
        },
      ]);
    });
  });

  it('should calculate size correctly', () => {
    const mdp = WorkingSet.fromSource('.', { registry: mockRegistry, tree });
    expect(mdp.size).to.equal(3);
  });
});
