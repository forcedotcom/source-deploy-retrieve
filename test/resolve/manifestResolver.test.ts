/*
 * Copyright 2026, Salesforce, Inc.
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

import { assert, expect } from 'chai';
import { createSandbox } from 'sinon';
import {
  ManifestResolver,
  MetadataComponent,
  NodeFSTreeContainer,
  registry,
  RegistryAccess,
  VirtualFile,
  VirtualTreeContainer,
} from '../../src';
import * as mockManifests from '../mock/manifestConstants';

const env = createSandbox();

describe('ManifestResolver', () => {
  afterEach(() => env.restore());

  describe('resolve', () => {
    it('should use expected default dependencies', async () => {
      const readFileStub = env.stub(NodeFSTreeContainer.prototype, 'readFile');
      const getTypeStub = env.stub(RegistryAccess.prototype, 'getTypeByName');
      readFileStub.resolves(mockManifests.ONE_FOLDER_MEMBER.data);
      getTypeStub.returns(registry.types.dashboardfolder);

      const resolver = new ManifestResolver();
      const result = await resolver.resolve(mockManifests.ONE_FOLDER_MEMBER.name);
      const expected: MetadataComponent[] = [
        {
          fullName: 'Test_Folder',
          type: registry.types.dashboardfolder,
        },
      ];

      expect(readFileStub.callCount).to.equal(1);
      expect(getTypeStub.callCount).to.equal(1);
      expect(result.components).to.deep.equal(expected);
    });

    it('should resolve components and api version in a manifest file', async () => {
      const resolver = new ManifestResolver(mockManifests.TREE);

      const result = await resolver.resolve(mockManifests.BASIC.name);
      const expected: MetadataComponent[] = [
        {
          fullName: 'a',
          type: registry.types.customobjecttranslation,
        },
        {
          fullName: 'b',
          type: registry.types.staticresource,
        },
        {
          fullName: 'c',
          type: registry.types.staticresource,
        },
      ];

      expect(result.components).to.deep.equal(expected);
    });

    it('should interpret a member of a type in folders with no delimiter as its corresponding folder type', async () => {
      const resolver = new ManifestResolver(mockManifests.TREE);

      const result = await resolver.resolve(mockManifests.ONE_FOLDER_MEMBER.name);
      const expected: MetadataComponent[] = [
        {
          fullName: 'Test_Folder',
          type: registry.types.documentfolder,
        },
      ];

      expect(result.components).to.deep.equal(expected);
    });

    it('should throw on invalid xml', async () => {
      const badManifest: VirtualFile = {
        name: 'bad-package.xml',
        data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
      <Package xmlns="http://soap.sforce.com/2006/04/metadata">
        <<types>
          <members></members>
          <name></name>
        </types>
        <version>52.0</version>
      </Package>\n`),
      };
      const tree = new VirtualTreeContainer([
        {
          dirPath: '.',
          children: [badManifest],
        },
      ]);
      const resolver = new ManifestResolver(tree);
      try {
        await resolver.resolve(badManifest.name);
        expect(true, 'expected invalid types definition error').to.be.false;
      } catch (error) {
        assert(error instanceof Error);
        expect(error.name).to.equal('InvalidManifest');
      }
    });
    it('should throw when type is empty', async () => {
      const badManifest: VirtualFile = {
        name: 'bad-package.xml',
        data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
      <Package xmlns="http://soap.sforce.com/2006/04/metadata">
        <types>
          <members></members>
          <name></name>
        </types>
        <version>52.0</version>
      </Package>\n`),
      };
      const tree = new VirtualTreeContainer([
        {
          dirPath: '.',
          children: [badManifest],
        },
      ]);
      const resolver = new ManifestResolver(tree);
      try {
        await resolver.resolve(badManifest.name);
        expect(true, 'expected invalid types definition error').to.be.false;
      } catch (error) {
        expect(error).to.have.property('name', 'InvalidManifest');
        expect(error)
          .to.have.property('message')
          .and.include(`Invalid types definition in manifest file: ${badManifest.name}`);
      }
    });

    it('should resolve nested InFolder types', async () => {
      const registry = new RegistryAccess();
      const reportType = registry.getTypeByName('report');
      const reportFolderType = registry.getTypeByName('reportFolder');
      const folderManifest: VirtualFile = {
        name: 'reports-package.xml',
        data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
      <Package xmlns="http://soap.sforce.com/2006/04/metadata">
        <types>
          <members>foo</members>
          <members>foo/subfoo</members>
          <members>foo/subfoo/MySubFooReport1</members>
          <members>foo/subfoo/MySubFooReport2</members>
          <members>bar/MyBarReport1</members>
          <members>bar/MyBarReport2</members>
          <name>Report</name>
        </types>
        <version>52.0</version>
      </Package>\n`),
      };
      const tree = new VirtualTreeContainer([
        {
          dirPath: '.',
          children: [folderManifest],
        },
      ]);
      const resolver = new ManifestResolver(tree);
      const result = await resolver.resolve(folderManifest.name);
      const expected: MetadataComponent[] = [
        {
          fullName: 'foo',
          type: reportFolderType,
        },
        {
          fullName: 'foo/subfoo',
          type: reportFolderType,
        },
        {
          fullName: 'foo/subfoo/MySubFooReport1',
          type: reportType,
        },
        {
          fullName: 'foo/subfoo/MySubFooReport2',
          type: reportType,
        },
        {
          fullName: 'bar/MyBarReport1',
          type: reportType,
        },
        {
          fullName: 'bar/MyBarReport2',
          type: reportType,
        },
      ];

      expect(result.components).to.deep.equal(expected);
    });

    it('should resolve nested InFolder types with trailing slashes', async () => {
      const registry = new RegistryAccess();
      const reportType = registry.getTypeByName('report');
      const reportFolderType = registry.getTypeByName('reportFolder');
      const folderManifest: VirtualFile = {
        name: 'reports-package.xml',
        data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
      <Package xmlns="http://soap.sforce.com/2006/04/metadata">
        <types>
          <members>foo/</members>
          <members>foo/subfoo/</members>
          <members>foo/subfoo/MySubFooReport1</members>
          <members>foo/subfoo/MySubFooReport2</members>
          <members>bar/MyBarReport1</members>
          <members>bar/MyBarReport2</members>
          <name>Report</name>
        </types>
        <version>52.0</version>
      </Package>\n`),
      };
      const tree = new VirtualTreeContainer([
        {
          dirPath: '.',
          children: [folderManifest],
        },
      ]);
      const resolver = new ManifestResolver(tree);
      const result = await resolver.resolve(folderManifest.name);
      const expected: MetadataComponent[] = [
        {
          fullName: 'foo',
          type: reportFolderType,
        },
        {
          fullName: 'foo/subfoo',
          type: reportFolderType,
        },
        {
          fullName: 'foo/subfoo/MySubFooReport1',
          type: reportType,
        },
        {
          fullName: 'foo/subfoo/MySubFooReport2',
          type: reportType,
        },
        {
          fullName: 'bar/MyBarReport1',
          type: reportType,
        },
        {
          fullName: 'bar/MyBarReport2',
          type: reportType,
        },
      ];

      expect(result.components).to.deep.equal(expected);
    });

    it('should resolve folderType types (Territory2*)', async () => {
      const registry = new RegistryAccess();
      const t2ModelType = registry.getTypeByName('Territory2Model');
      const t2RuleType = registry.getTypeByName('Territory2Rule');
      const t2Type = registry.getTypeByName('Territory2');
      const t2TypeType = registry.getTypeByName('Territory2Type');
      const t2Manifest: VirtualFile = {
        name: 'territory2-package.xml',
        data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
      <Package xmlns="http://soap.sforce.com/2006/04/metadata">
        <types>
          <members>My_Territory_Model</members>
          <name>Territory2Model</name>
        </types>
        <types>
          <members>My_Territory_Model.Fishing_Stores</members>
          <name>Territory2Rule</name>
        </types>
        <types>
          <members>My_Territory_Model.Austin</members>
          <members>My_Territory_Model.Texas</members>
          <members>My_Territory_Model.USA</members>
          <name>Territory2</name>
        </types>
        <types>
          <members>City</members>
          <members>Country</members>
          <members>State</members>
          <name>Territory2Type</name>
        </types>
        <version>52.0</version>
      </Package>\n`),
      };
      const tree = new VirtualTreeContainer([
        {
          dirPath: '.',
          children: [t2Manifest],
        },
      ]);
      const resolver = new ManifestResolver(tree);
      const result = await resolver.resolve(t2Manifest.name);
      const expected: MetadataComponent[] = [
        {
          fullName: 'My_Territory_Model',
          type: t2ModelType,
        },
        {
          fullName: 'My_Territory_Model.Fishing_Stores',
          type: t2RuleType,
        },
        {
          fullName: 'My_Territory_Model.Austin',
          type: t2Type,
        },
        {
          fullName: 'My_Territory_Model.Texas',
          type: t2Type,
        },
        {
          fullName: 'My_Territory_Model.USA',
          type: t2Type,
        },
        {
          fullName: 'City',
          type: t2TypeType,
        },
        {
          fullName: 'Country',
          type: t2TypeType,
        },
        {
          fullName: 'State',
          type: t2TypeType,
        },
      ];
      expect(result.components).to.deep.equal(expected);
    });
  });
});
