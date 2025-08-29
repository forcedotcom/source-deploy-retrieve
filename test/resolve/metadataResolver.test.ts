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

import { basename, dirname, join } from 'node:path';
import { assert, expect } from 'chai';
import { Messages, SfError } from '@salesforce/core';
import { ensureString } from '@salesforce/ts-types';
import { createSandbox } from 'sinon';
import {
  ComponentSet,
  MetadataResolver,
  registry,
  RegistryAccess,
  SourceComponent,
  VirtualDirectory,
  VirtualTreeContainer,
} from '../../src';
import {
  bundle,
  decomposedtoplevel,
  matchingContentFile,
  mixedContentDirectory,
  mixedContentInFolder,
  xmlInFolder,
} from '../mock';
import {
  DECOMPOSED_CHILD_COMPONENT_1,
  DECOMPOSED_CHILD_DIR_PATH,
  DECOMPOSED_CHILD_XML_PATH_1,
  DECOMPOSED_CHILD_XML_PATH_2,
  DECOMPOSED_COMPONENT,
  DECOMPOSED_PATH,
  DECOMPOSED_VIRTUAL_FS,
  DECOMPOSED_XML_PATH,
} from '../mock/type-constants/customObjectConstant';
import {
  MIXED_CONTENT_DIRECTORY_COMPONENT,
  MIXED_CONTENT_DIRECTORY_CONTENT_PATH,
  MIXED_CONTENT_DIRECTORY_DIR,
  MIXED_CONTENT_DIRECTORY_VIRTUAL_FS,
  MIXED_CONTENT_DIRECTORY_XML_PATHS,
} from '../mock/type-constants/staticresourceConstant';
import {
  SOURCE_FORMAT_PS,
  regAcc as regAccPermissionSet,
} from '../mock/type-constants/decomposedPermissionSetConstant';
// import { THREE_CUSTOM_LABELS_CMP, regAcc as regAccCustomLabels } from '../mock/type-constants/decomposedCustomLabelsConstant';
import { META_XML_SUFFIX } from '../../src/common';
import { DE_METAFILE } from '../mock/type-constants/digitalExperienceBundleConstants';
import { RegistryTestUtil } from './registryTestUtil';

const testUtil = new RegistryTestUtil();

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

describe('MetadataResolver', () => {
  const resolver = new MetadataResolver();
  const registryAccess = new RegistryAccess(registry);
  describe('Should not resolve using strictDir when suffixes do not match', () => {
    const type = registryAccess.getTypeByName('ApexClass');
    const COMPONENT_NAMES = ['myClass'];
    // real scenario: classes/foo/objects/myCls.cls (where objects is the strictDir of another type)
    const TYPE_DIRECTORY = join('classes', 'subfolder', 'subfolder2', 'objects');
    const XML_NAMES = COMPONENT_NAMES.map((name) => `${name}.${type.suffix}${META_XML_SUFFIX}`);
    const XML_PATHS = XML_NAMES.map((name) => join(TYPE_DIRECTORY, name));
    const CONTENT_NAMES = COMPONENT_NAMES.map((name) => `${name}.${type.suffix}`);
    const CONTENT_PATHS = CONTENT_NAMES.map((name) => join(TYPE_DIRECTORY, name));
    const TREE = new VirtualTreeContainer([
      {
        dirPath: TYPE_DIRECTORY,
        children: XML_NAMES.concat(CONTENT_NAMES),
      },
    ]);
    const COMPONENTS = COMPONENT_NAMES.map(
      (name, index) =>
        new SourceComponent(
          {
            name,
            type,
            xml: XML_PATHS[index],
            content: CONTENT_PATHS[index],
          },
          TREE
        )
    );
    it('metadata file', () => {
      const resolver = new MetadataResolver(registryAccess, TREE);
      const sourceComponent = resolver.getComponentsFromPath(XML_PATHS[0])[0];
      expect(sourceComponent.type).to.deep.equal(type);
      expect(sourceComponent).to.deep.equal(COMPONENTS[0]);
    });
    it('content file', () => {
      const resolver = new MetadataResolver(registryAccess, TREE);
      expect(resolver.getComponentsFromPath(CONTENT_PATHS[0])).to.deep.equal([COMPONENTS[0]]);
    });
  });

  describe('getComponentsFromPath', () => {
    afterEach(() => testUtil.restore());

    describe('File Paths', () => {
      it('Should throw file not found error if given path does not exist', () => {
        const path = matchingContentFile.CONTENT_PATHS[0];

        assert.throws(
          () => resolver.getComponentsFromPath(path),
          SfError,
          messages.getMessage('error_path_not_found', [path])
        );
      });

      it('Should determine type for metadata file with known suffix', () => {
        const path = matchingContentFile.XML_PATHS[0];
        const access = testUtil.createMetadataResolver([
          {
            dirPath: matchingContentFile.TYPE_DIRECTORY,
            children: [matchingContentFile.CONTENT_NAMES[0], matchingContentFile.XML_NAMES[0]],
          },
        ]);
        testUtil.stubAdapters([
          {
            type: registry.types.apexclass,
            componentMappings: [
              {
                path,
                component: matchingContentFile.COMPONENT,
              },
            ],
          },
        ]);
        expect(access.getComponentsFromPath(path)).to.deep.equal([matchingContentFile.COMPONENT]);
      });

      it('Should determine type for source file with known suffix', () => {
        const path = matchingContentFile.CONTENT_PATHS[0];
        const access = testUtil.createMetadataResolver([
          {
            dirPath: matchingContentFile.TYPE_DIRECTORY,
            children: [matchingContentFile.CONTENT_NAMES[0], matchingContentFile.XML_NAMES[0]],
          },
        ]);
        testUtil.stubAdapters([
          {
            type: registry.types.apexclass,
            componentMappings: [{ path, component: matchingContentFile.COMPONENT }],
          },
        ]);
        expect(access.getComponentsFromPath(path)).to.deep.equal([matchingContentFile.COMPONENT]);
      });

      it('Should resolve decomposed permission set file to PermissionSet type', () => {
        const resolver = new MetadataResolver(regAccPermissionSet, SOURCE_FORMAT_PS.tree);
        const objectSettingsPath = join(
          'main',
          'default',
          'permissionsets',
          'myPS',
          'objectSettings',
          'Account.objectSettings-meta.xml'
        );
        const classAccessPath = join('main', 'default', 'permissionsets', 'myPS', 'myPS.classAccess-meta.xml');
        const components = resolver.getComponentsFromPath(objectSettingsPath);
        const components2 = resolver.getComponentsFromPath(classAccessPath);
        expect(components).to.have.lengthOf(1);
        expect(components[0].type.name).to.equal('PermissionSet');
        expect(components2).to.have.lengthOf(1);
        expect(components2[0].type.name).to.equal('PermissionSet');
      });

      it('Should determine type for metadata file with known suffix and strictDirectoryName', () => {
        // CustomSite is an example.  The conditions are:
        //   1. Type has "strictDirectoryName": true
        //   2. Type strategy adapter is neither "mixedContent" nor "bundle"
        //   3. Type doesn't have children
        //   4. mdapi format file path (E_Bikes.site)
        const path = join('unpackaged', 'sites', 'E_Bikes.site');
        const treeContainer = VirtualTreeContainer.fromFilePaths([path]);
        const mdResolver = new MetadataResolver(undefined, treeContainer);
        const expectedComponent = new SourceComponent(
          {
            name: 'E_Bikes',
            type: registry.types.customsite,
            xml: path,
          },
          treeContainer
        );
        expect(mdResolver.getComponentsFromPath(path)).to.deep.equal([expectedComponent]);
      });

      it('Should determine type for source file with known suffix and strictDirectoryName', () => {
        // CustomSite is an example.  The conditions are:
        //   1. Type has "strictDirectoryName": true
        //   2. Type strategy adapter is neither "mixedContent" nor "bundle"
        //   3. Type doesn't have children
        //   4. source format file path (E_Bikes.site-meta.xml)
        const path = join('unpackaged', 'sites', 'E_Bikes.site-meta.xml');
        const treeContainer = VirtualTreeContainer.fromFilePaths([path]);
        const mdResolver = new MetadataResolver(undefined, treeContainer);
        const expectedComponent = new SourceComponent(
          {
            name: 'E_Bikes',
            type: registry.types.customsite,
            xml: path,
          },
          treeContainer
        );
        expect(mdResolver.getComponentsFromPath(path)).to.deep.equal([expectedComponent]);
      });

      it('Should determine type for EmailServicesFunction metadata file (mdapi format)', () => {
        const path = join('unpackaged', 'emailservices', 'MyEmailServices.xml');
        const treeContainer = VirtualTreeContainer.fromFilePaths([path]);
        const mdResolver = new MetadataResolver(undefined, treeContainer);
        const expectedComponent = new SourceComponent(
          {
            name: 'MyEmailServices',
            type: registry.types.emailservicesfunction,
            xml: path,
          },
          treeContainer
        );
        expect(mdResolver.getComponentsFromPath(path)).to.deep.equal([expectedComponent]);
      });

      it('Should determine type for DigitalExperience metadata file (_meta.json file)', () => {
        const parent = join('unpackaged', 'digitalExperiences', 'site', 'foo');
        const parent_meta_file = join(parent, 'foo.digitalExperience-meta.xml');
        assert(DE_METAFILE);
        const path = join(parent, 'sfdc_cms__view', 'home', DE_METAFILE);
        const treeContainer = VirtualTreeContainer.fromFilePaths([path, parent_meta_file]);
        const mdResolver = new MetadataResolver(undefined, treeContainer);
        const parentComponent = new SourceComponent(
          {
            name: 'site/foo',
            type: registry.types.digitalexperiencebundle,
            xml: parent_meta_file,
          },
          treeContainer
        );
        assert(registry.types.digitalexperiencebundle.children?.types.digitalexperience);
        const expectedComponent = new SourceComponent(
          {
            name: 'sfdc_cms__view/home',
            type: registry.types.digitalexperiencebundle.children.types.digitalexperience,
            content: dirname(path),
            xml: path,
            parent: parentComponent,
            parentType: registry.types.digitalexperiencebundle,
          },
          treeContainer
        );
        expect(mdResolver.getComponentsFromPath(path)).to.deep.equal([expectedComponent]);
      });

      it('Should determine type for path of mixed content type', () => {
        const path = mixedContentDirectory.MIXED_CONTENT_DIRECTORY_SOURCE_PATHS[1];
        const access = testUtil.createMetadataResolver([
          {
            dirPath: dirname(path),
            children: [basename(path)],
          },
        ]);
        testUtil.stubAdapters([
          {
            type: registry.types.staticresource,
            componentMappings: [{ path, component: mixedContentDirectory.MIXED_CONTENT_DIRECTORY_COMPONENT }],
          },
        ]);
        expect(access.getComponentsFromPath(path)).to.deep.equal([
          mixedContentDirectory.MIXED_CONTENT_DIRECTORY_COMPONENT,
        ]);
      });

      it('Should determine type for path content files', () => {
        const path = matchingContentFile.CONTENT_PATHS[0];
        const access = testUtil.createMetadataResolver([
          {
            dirPath: dirname(path),
            children: matchingContentFile.CONTENT_NAMES,
          },
        ]);
        testUtil.stubAdapters([
          {
            type: registry.types.apexclass,
            componentMappings: [{ path, component: matchingContentFile.CONTENT_COMPONENT }],
            allowContent: false,
          },
        ]);
        expect(access.getComponentsFromPath(path)).to.deep.equal([matchingContentFile.CONTENT_COMPONENT]);
      });

      it('Should determine type for inFolder path content files', () => {
        const path = xmlInFolder.COMPONENT_FOLDER_PATH;
        const access = testUtil.createMetadataResolver([
          {
            dirPath: path,
            children: xmlInFolder.XML_NAMES,
          },
        ]);
        const componentMappings = xmlInFolder.COMPONENTS.map((c: SourceComponent) => ({
          path: ensureString(c.xml),
          component: c,
        }));
        testUtil.stubAdapters([
          {
            type: registry.types.report,
            componentMappings,
            allowContent: false,
          },
        ]);
        expect(access.getComponentsFromPath(path)).to.deep.equal(xmlInFolder.COMPONENTS);
      });

      it('should parse dirs before files', () => {
        const path = xmlInFolder.COMPONENT_FOLDER_PATH;
        const env = createSandbox();

        const access = testUtil.createMetadataResolver([
          {
            dirPath: path,
            children: ['dir1', { name: 'parent.report-meta.xml', data: Buffer.from('Some Data') }],
          },
          {
            dirPath: join(path, 'dir1'),
            children: [{ name: 'dir1.report-meta.xml', data: Buffer.from('Some Data') }],
          },
        ]);
        // @ts-ignore
        const isDirSpy = env.spy(access.tree, 'isDirectory');

        const componentMappings = xmlInFolder.COMPONENTS.map((c: SourceComponent) => ({
          path: ensureString(c.xml),
          component: c,
        }));
        testUtil.stubAdapters([
          {
            type: registry.types.report,
            componentMappings,
            allowContent: false,
          },
        ]);
        access.getComponentsFromPath(path);
        // isDirectory is called a few times during recursive parsing, after debugging
        // we only need to verify calls made in succession are called with dirs, and then files
        expect([isDirSpy.args[3][0], isDirSpy.args[4][0]]).to.deep.equal([path, join(path, 'parent.report-meta.xml')]);
        expect([isDirSpy.args[7][0], isDirSpy.args[8][0]]).to.deep.equal([
          join(path, 'dir1'),
          join(path, 'parent.report-meta.xml'),
        ]);
        expect([isDirSpy.args[10][0], isDirSpy.args[11][0]]).to.deep.equal([
          join(path, 'dir1'),
          join(path, 'dir1', 'dir1.report-meta.xml'),
        ]);
      });

      it('Should determine type for folder files', () => {
        const path = xmlInFolder.TYPE_DIRECTORY;
        const access = testUtil.createMetadataResolver([
          {
            dirPath: path,
            children: [xmlInFolder.FOLDER_XML_NAME],
          },
        ]);
        testUtil.stubAdapters([
          {
            type: registry.types.reportfolder,
            componentMappings: [{ path: xmlInFolder.FOLDER_XML_PATH, component: xmlInFolder.FOLDER_COMPONENT }],
            allowContent: false,
          },
        ]);
        expect(access.getComponentsFromPath(path)).to.deep.equal([xmlInFolder.FOLDER_COMPONENT]);
      });

      it('should resolve folderContentTypes (e.g. reportFolder, emailFolder) in mdapi format', () => {
        const registryAccess = new RegistryAccess();
        const reportFolderDir = join('unpackaged', 'reports', 'foo');
        const virtualFS: VirtualDirectory[] = [{ dirPath: reportFolderDir, children: ['bar-meta.xml'] }];
        const tree = new VirtualTreeContainer(virtualFS);
        const mdResolver = new MetadataResolver(registryAccess, tree);
        const reportFolderPath = join(reportFolderDir, 'bar-meta.xml');
        const comp = mdResolver.getComponentsFromPath(reportFolderPath);
        expect(comp).to.be.an('array').with.lengthOf(1);
        expect(comp[0]).to.have.property('name', 'foo/bar');
        expect(comp[0]).to.have.deep.property('type', registryAccess.getTypeByName('ReportFolder'));
      });

      it('Should not mistake folder component of a mixed content type as that type', () => {
        // this test has coveage on non-mixedContent types as well by nature of the execution path
        const path = mixedContentInFolder.FOLDER_XML_PATH;
        const access = testUtil.createMetadataResolver([
          {
            dirPath: mixedContentInFolder.TYPE_DIRECTORY,
            children: [basename(path)],
          },
        ]);
        testUtil.stubAdapters([
          {
            type: registry.types.documentfolder,
            componentMappings: [{ path, component: mixedContentInFolder.FOLDER_COMPONENT }],
          },
        ]);
        expect(access.getComponentsFromPath(path)).to.deep.equal([mixedContentInFolder.FOLDER_COMPONENT]);
      });

      it('Should throw type id error if one could not be determined', () => {
        const missing = join('path', 'to', 'whatever', 'a.b-meta.afg');
        const access = testUtil.createMetadataResolver([
          {
            dirPath: dirname(missing),
            children: [basename(missing)],
          },
        ]);
        assert.throws(
          () => access.getComponentsFromPath(missing),
          SfError,
          messages.getMessage('error_could_not_infer_type', [missing])
        );
      });

      it('Should not return a component if path to metadata xml is forceignored', () => {
        const path = matchingContentFile.XML_PATHS[0];
        const access = testUtil.createMetadataResolver([
          {
            dirPath: dirname(path),
            children: [basename(path)],
          },
        ]);
        testUtil.stubForceIgnore({ seed: path, deny: [path] });
        testUtil.stubAdapters([
          {
            type: registry.types.apexclass,
            // should not be returned
            componentMappings: [{ path, component: matchingContentFile.COMPONENT }],
          },
        ]);
        expect(access.getComponentsFromPath(path).length).to.equal(0);
      });

      // metadataResolver has the option to NOT use the forceIgnore file.
      it('Should return a component if path to metadata xml is forceignored but forceignore is not used', () => {
        const path = matchingContentFile.XML_PATHS[0];
        const access = testUtil.createMetadataResolver(
          [
            {
              dirPath: dirname(path),
              children: [basename(path)],
            },
          ],
          false
        );
        testUtil.stubForceIgnore({ seed: path, deny: [path] });
        testUtil.stubAdapters([
          {
            type: registry.types.apexclass,
            // should not be returned
            componentMappings: [{ path, component: matchingContentFile.COMPONENT }],
          },
        ]);
        expect(access.getComponentsFromPath(path).length).to.equal(1);
      });

      it('Should not return a component if path to content metadata xml is forceignored', () => {
        const path = matchingContentFile.XML_PATHS[0];
        const access = testUtil.createMetadataResolver([
          {
            dirPath: dirname(path),
            children: [basename(path)],
          },
        ]);
        testUtil.stubForceIgnore({ seed: path, deny: [path] });
        testUtil.stubAdapters([
          {
            type: registry.types.apexclass,
            // should not be returned
            componentMappings: [{ path, component: matchingContentFile.COMPONENT }],
          },
        ]);
        expect(access.getComponentsFromPath(path).length).to.equal(0);
      });

      it('Should not throw TypeInferenceError for a non-metadata file that is not part of an inclusive filter', () => {
        const emailservicesPath = join('unpackaged', 'emailservices', 'MyEmailServices.xml');
        const nonMetadataDirPath = join('unpackaged', 'datasets');
        const nonMetadataFilePath = join(nonMetadataDirPath, 'myDS.xml');
        const emailservicesComponent = new SourceComponent(
          {
            name: 'MyEmailServices',
            type: registry.types.emailservicesfunction,
            xml: emailservicesPath,
          },
          VirtualTreeContainer.fromFilePaths([emailservicesPath])
        );
        const filter = new ComponentSet([emailservicesComponent]);
        const treeContainer = VirtualTreeContainer.fromFilePaths([emailservicesPath, nonMetadataFilePath]);
        const mdResolver = new MetadataResolver(undefined, treeContainer, false);
        expect(mdResolver.getComponentsFromPath(nonMetadataDirPath, filter)).to.deep.equal([]);
      });

      it('Should resolve RestrictionRules metadata in mdapi format', () => {
        const unpackagedPath = 'unpackaged';
        const packageXmlPath = join(unpackagedPath, 'package.xml');
        const restrictionRulesPath = join('unpackaged', 'restrictionRules');
        const restrictionRulePath = join(restrictionRulesPath, 'Foo.rule');
        const treeContainer = VirtualTreeContainer.fromFilePaths([
          unpackagedPath,
          packageXmlPath,
          restrictionRulesPath,
          restrictionRulePath,
        ]);
        const restrictionRuleComponent = new SourceComponent(
          {
            name: 'Foo',
            type: registry.types.restrictionrule,
            xml: restrictionRulePath,
          },
          treeContainer
        );
        const mdResolver = new MetadataResolver(undefined, treeContainer, false);
        expect(mdResolver.getComponentsFromPath(unpackagedPath)).to.deep.equal([restrictionRuleComponent]);
      });

      it('Should not return a component if path to folder metadata xml is forceignored', () => {
        const path = xmlInFolder.FOLDER_XML_PATH;
        const access = testUtil.createMetadataResolver([
          {
            dirPath: dirname(path),
            children: [basename(path)],
          },
        ]);
        testUtil.stubForceIgnore({ seed: path, deny: [path] });
        testUtil.stubAdapters([
          {
            type: registry.types.document,
            // should not be returned
            componentMappings: [{ path: xmlInFolder.FOLDER_XML_PATH, component: xmlInFolder.FOLDER_COMPONENT }],
          },
        ]);
        expect(access.getComponentsFromPath(path).length).to.equal(0);
      });
    });

    describe('Directory Paths', () => {
      it('Should return all components in a directory', () => {
        const resolver = testUtil.createMetadataResolver([
          {
            dirPath: xmlInFolder.COMPONENT_FOLDER_PATH,
            children: xmlInFolder.XML_NAMES,
          },
        ]);
        const componentMappings = xmlInFolder.XML_PATHS.map((p: string, i: number) => ({
          path: p,
          component: xmlInFolder.COMPONENTS[i],
        }));
        testUtil.stubAdapters([
          {
            type: registry.types.report,
            componentMappings,
          },
        ]);
        expect(resolver.getComponentsFromPath(xmlInFolder.COMPONENT_FOLDER_PATH)).to.deep.equal(xmlInFolder.COMPONENTS);
      });

      it('Should walk all file and directory children', () => {
        const { TYPE_DIRECTORY: apexDir } = matchingContentFile;
        const populatedDir = join(apexDir, 'populated');
        const emptyDir = join(apexDir, 'empty');
        const documentXml = join(apexDir, xmlInFolder.XML_NAMES[0]);
        const apexXml = matchingContentFile.XML_PATHS[0];
        const apexContent = matchingContentFile.CONTENT_PATHS[0];
        const apexBXml = join(populatedDir, matchingContentFile.XML_NAMES[1]);
        const apexBContent = join(populatedDir, matchingContentFile.CONTENT_NAMES[1]);
        const tree = new VirtualTreeContainer([
          {
            dirPath: apexDir,
            children: [basename(apexXml), basename(apexContent), xmlInFolder.XML_NAMES[0], 'populated', 'empty'],
          },
          {
            dirPath: emptyDir,
            children: [],
          },
          {
            dirPath: populatedDir,
            children: [basename(apexBContent), basename(apexBXml)],
          },
        ]);
        const apexComponentB = new SourceComponent(
          {
            name: 'classB',
            type: registry.types.apexclass,
            xml: apexBXml,
            content: apexBContent,
          },
          tree
        );
        const reportComponent = new SourceComponent(
          {
            name: 'report',
            type: registry.types.report,
            xml: documentXml,
          },
          tree
        );
        const access = new MetadataResolver(undefined, tree);
        testUtil.stubAdapters([
          {
            type: registry.types.report,
            componentMappings: [
              {
                path: join(apexDir, xmlInFolder.XML_NAMES[0]),
                component: reportComponent,
              },
            ],
          },
          {
            type: registry.types.apexclass,
            componentMappings: [
              {
                path: apexXml,
                component: matchingContentFile.COMPONENT,
              },
              {
                path: apexBXml,
                component: apexComponentB,
              },
            ],
          },
        ]);
        expect(access.getComponentsFromPath(apexDir)).to.deep.equal([
          matchingContentFile.COMPONENT,
          reportComponent,
          apexComponentB,
        ]);
      });

      it('Should handle the folder of a mixed content folder type', () => {
        const access = testUtil.createMetadataResolver([
          {
            dirPath: mixedContentInFolder.COMPONENT_FOLDER_PATH,
            children: mixedContentInFolder.XML_NAMES.concat(mixedContentInFolder.CONTENT_NAMES),
          },
        ]);
        testUtil.stubAdapters([
          {
            type: registry.types.document,
            componentMappings: [
              {
                path: mixedContentInFolder.XML_PATHS[0],
                component: mixedContentInFolder.COMPONENTS[0],
              },
              {
                path: mixedContentInFolder.XML_PATHS[1],
                component: mixedContentInFolder.COMPONENTS[1],
              },
            ],
          },
        ]);
        expect(access.getComponentsFromPath(mixedContentInFolder.COMPONENT_FOLDER_PATH)).to.deep.equal([
          mixedContentInFolder.COMPONENTS[0],
          mixedContentInFolder.COMPONENTS[1],
        ]);
      });

      it('Should return a component for a directory that is content or a child of content', () => {
        const { MIXED_CONTENT_DIRECTORY_CONTENT_PATH } = mixedContentDirectory;
        const access = testUtil.createMetadataResolver([
          {
            dirPath: MIXED_CONTENT_DIRECTORY_CONTENT_PATH,
            children: [],
          },
          {
            dirPath: mixedContentDirectory.MIXED_CONTENT_DIRECTORY_DIR,
            children: [
              mixedContentDirectory.MIXED_CONTENT_DIRECTORY_XML_NAMES[0],
              basename(MIXED_CONTENT_DIRECTORY_CONTENT_PATH),
            ],
          },
        ]);
        testUtil.stubAdapters([
          {
            type: registry.types.staticresource,
            componentMappings: [
              {
                path: MIXED_CONTENT_DIRECTORY_CONTENT_PATH,
                component: mixedContentDirectory.MIXED_CONTENT_DIRECTORY_COMPONENT,
              },
            ],
          },
        ]);
        expect(access.getComponentsFromPath(MIXED_CONTENT_DIRECTORY_CONTENT_PATH)).to.deep.equal([
          mixedContentDirectory.MIXED_CONTENT_DIRECTORY_COMPONENT,
        ]);
      });

      it('Should not add duplicates of a component when the content has multiple -meta.xmls', () => {
        const { COMPONENT, CONTENT_PATH } = bundle;
        const access = testUtil.createMetadataResolver([
          {
            dirPath: bundle.TYPE_DIRECTORY,
            children: [basename(CONTENT_PATH)],
          },
          {
            dirPath: CONTENT_PATH,
            children: bundle.SOURCE_PATHS.concat(bundle.XML_PATH).map((p) => basename(p)),
          },
        ]);
        testUtil.stubAdapters([
          {
            type: registry.types.auradefinitionbundle,
            componentMappings: [
              { path: bundle.CONTENT_PATH, component: COMPONENT },
              { path: bundle.XML_PATH, component: COMPONENT },
              {
                path: bundle.SUBTYPE_XML_PATH,
                component: COMPONENT,
              },
            ],
          },
        ]);
        expect(access.getComponentsFromPath(bundle.TYPE_DIRECTORY)).to.deep.equal([COMPONENT]);
      });

      it('Should not add duplicate component if directory content and xml are at the same level', () => {
        const access = testUtil.createMetadataResolver(MIXED_CONTENT_DIRECTORY_VIRTUAL_FS);
        const component = SourceComponent.createVirtualComponent(
          MIXED_CONTENT_DIRECTORY_COMPONENT,
          MIXED_CONTENT_DIRECTORY_VIRTUAL_FS
        );
        testUtil.stubAdapters([
          {
            type: registry.types.staticresource,
            componentMappings: [
              { path: MIXED_CONTENT_DIRECTORY_CONTENT_PATH, component },
              { path: MIXED_CONTENT_DIRECTORY_XML_PATHS[0], component },
            ],
          },
        ]);

        expect(access.getComponentsFromPath(MIXED_CONTENT_DIRECTORY_DIR)).to.deep.equal([component]);
      });

      it('should stop resolution if parent component is resolved', () => {
        const access = testUtil.createMetadataResolver(DECOMPOSED_VIRTUAL_FS);
        testUtil.stubAdapters([
          {
            type: registry.types.customobject,
            componentMappings: [
              { path: DECOMPOSED_XML_PATH, component: DECOMPOSED_COMPONENT },
              { path: DECOMPOSED_CHILD_XML_PATH_1, component: DECOMPOSED_CHILD_COMPONENT_1 },
            ],
          },
        ]);
        expect(access.getComponentsFromPath(DECOMPOSED_PATH)).to.deep.equal([DECOMPOSED_COMPONENT]);
      });

      it('should return expected child SourceComponent when given a subdirectory of a folderPerType component', () => {
        const tree = new VirtualTreeContainer(DECOMPOSED_VIRTUAL_FS);
        const access = testUtil.createMetadataResolver(DECOMPOSED_VIRTUAL_FS);
        const expectedComponent = new SourceComponent(DECOMPOSED_COMPONENT, tree);
        const children = expectedComponent.getChildren();
        const expectedChild = children.find((c) => c.xml === DECOMPOSED_CHILD_XML_PATH_2);
        expect(access.getComponentsFromPath(DECOMPOSED_CHILD_DIR_PATH)).to.deep.equal([expectedChild]);
      });

      /**
       * Because files of a mixed content type could have any suffix, they might collide
       * with a type that uses the "suffix index" in the registry and be assigned the incorrect type.
       *
       * Pretend that this bundle's root xml suffix is the same as MatchingContentFile - still should be
       * identified as bundle type
       */
      it('should handle suffix collision for mixed content types', () => {
        const tree = new VirtualTreeContainer([
          {
            dirPath: bundle.TYPE_DIRECTORY,
            children: [basename(bundle.CONTENT_PATH)],
          },
          {
            dirPath: bundle.CONTENT_PATH,
            children: [matchingContentFile.XML_NAMES[0], basename(bundle.SOURCE_PATHS[0])],
          },
        ]);
        const access = new MetadataResolver(undefined, tree);
        expect(access.getComponentsFromPath(bundle.TYPE_DIRECTORY)).to.deep.equal([
          new SourceComponent(
            {
              name: 'myComponent',
              type: registry.types.auradefinitionbundle,
              xml: join(bundle.CONTENT_PATH, matchingContentFile.XML_NAMES[0]),
              content: bundle.CONTENT_PATH,
            },
            tree
          ),
        ]);
      });

      it('should not return components if the directory is forceignored', () => {
        const dirPath = xmlInFolder.COMPONENT_FOLDER_PATH;
        testUtil.stubForceIgnore({
          seed: dirPath,
          deny: [join(dirPath, 'a.report-meta.xml'), join(dirPath, 'b.report-meta.xml')],
        });
        const access = testUtil.createMetadataResolver([
          {
            dirPath,
            children: [xmlInFolder.XML_NAMES[0], xmlInFolder.XML_NAMES[1]],
          },
        ]);
        testUtil.stubAdapters([
          {
            type: registry.types.document,
            componentMappings: [
              {
                path: xmlInFolder.XML_PATHS[0],
                component: xmlInFolder.COMPONENTS[0],
              },
              {
                path: xmlInFolder.XML_PATHS[1],
                component: xmlInFolder.COMPONENTS[1],
              },
            ],
          },
        ]);
        expect(access.getComponentsFromPath(dirPath).length).to.equal(0);
      });
    });

    it('should ignore directories as fsPaths', () => {
      // NOTE on what this test is for: When an ExperienceBundle type is retrieved
      // as part of a project's metadata, but the ExperienceBundle dir and all files
      // in that dir are ignored, it would throw an error. This ensures it doesn't
      // throw and also doesn't resolve any components.
      const dirPath = mixedContentDirectory.MIXED_CONTENT_DIRECTORY_DIR;
      const fsPath = mixedContentDirectory.MIXED_CONTENT_DIRECTORY_CONTENT_PATH;
      const topLevelXmlPath = mixedContentDirectory.MIXED_CONTENT_DIRECTORY_XML_PATHS[0];
      testUtil.stubForceIgnore({ seed: dirPath, deny: [fsPath, topLevelXmlPath] });
      const access = testUtil.createMetadataResolver([
        {
          dirPath,
          children: [basename(fsPath), basename(topLevelXmlPath)],
        },
        {
          dirPath: fsPath,
          children: [],
        },
      ]);
      testUtil.stubAdapters([
        {
          type: registry.types.experiencebundle,
          componentMappings: [
            {
              path: topLevelXmlPath,
              component: mixedContentDirectory.MIXED_CONTENT_DIRECTORY_COMPONENT,
            },
          ],
        },
      ]);
      expect(access.getComponentsFromPath(dirPath).length).to.equal(0);
    });

    describe('Filtering', () => {
      it('should only return components present in filter', () => {
        const resolver = testUtil.createMetadataResolver([
          {
            dirPath: xmlInFolder.COMPONENT_FOLDER_PATH,
            children: xmlInFolder.XML_NAMES,
          },
        ]);
        const componentMappings = xmlInFolder.XML_PATHS.map((p: string, i: number) => ({
          path: p,
          component: xmlInFolder.COMPONENTS[i],
        }));
        testUtil.stubAdapters([
          {
            type: registry.types.report,
            componentMappings,
          },
        ]);
        const toFilter = {
          fullName: xmlInFolder.COMPONENTS[0].fullName,
          type: registry.types.report,
        };
        const filter = new ComponentSet([toFilter]);

        const result = resolver.getComponentsFromPath(xmlInFolder.COMPONENT_FOLDER_PATH, filter);

        expect(result).to.deep.equal([xmlInFolder.COMPONENTS[0]]);
      });

      it('should resolve child components when present in filter', () => {
        const resolver = testUtil.createMetadataResolver(decomposedtoplevel.DECOMPOSED_VIRTUAL_FS);
        const children = decomposedtoplevel.DECOMPOSED_TOP_LEVEL_COMPONENT.getChildren();
        const componentMappings = children.map((c: SourceComponent) => ({
          path: ensureString(c.xml),
          component: c,
        }));
        componentMappings.push({
          path: decomposedtoplevel.DECOMPOSED_TOP_LEVEL_XML_PATH,
          component: decomposedtoplevel.DECOMPOSED_TOP_LEVEL_COMPONENT,
        });
        testUtil.stubAdapters([
          {
            type: registry.types.customobjecttranslation,
            componentMappings,
          },
        ]);
        const toFilter = [
          {
            fullName: children[0].fullName,
            type: children[0].type,
          },
          {
            fullName: children[1].fullName,
            type: children[1].type,
          },
        ];
        const filter = new ComponentSet(toFilter);

        const result = resolver.getComponentsFromPath(decomposedtoplevel.DECOMPOSED_TOP_LEVEL_COMPONENT_PATH, filter);

        expect(result).to.deep.equal(children);
      });

      it('should resolve directory component if in filter', () => {
        const resolver = new MetadataResolver(undefined, bundle.COMPONENT.tree);
        testUtil.stubAdapters([
          {
            type: registry.types.auradefinitionbundle,
            componentMappings: [
              {
                path: bundle.CONTENT_PATH,
                component: bundle.COMPONENT,
              },
            ],
          },
        ]);
        const filter = new ComponentSet([
          {
            fullName: bundle.COMPONENT.fullName,
            type: bundle.COMPONENT.type,
          },
        ]);

        const result = resolver.getComponentsFromPath(bundle.TYPE_DIRECTORY, filter);

        expect(result).to.deep.equal([bundle.COMPONENT]);
      });

      it('should not resolve directory component if not in filter', () => {
        const resolver = testUtil.createMetadataResolver([
          {
            dirPath: bundle.TYPE_DIRECTORY,
            children: [basename(bundle.CONTENT_PATH)],
          },
          {
            dirPath: bundle.CONTENT_PATH,
            children: bundle.SOURCE_PATHS.map((p) => basename(p)).concat([bundle.XML_NAME]),
          },
        ]);
        testUtil.stubAdapters([
          {
            type: registry.types.auradefinitionbundle,
            componentMappings: [
              {
                path: bundle.CONTENT_PATH,
                component: bundle.COMPONENT,
              },
            ],
          },
        ]);
        const filter = new ComponentSet();

        const result = resolver.getComponentsFromPath(bundle.TYPE_DIRECTORY, filter);

        expect(result).to.deep.equal([]);
      });
    });

    it('should filter out empty directories when resolving components', () => {
      const resolver = testUtil.createMetadataResolver([
        {
          dirPath: bundle.TYPE_DIRECTORY,
          children: ['myComponent', 'emptyComponent'],
        },
        {
          dirPath: bundle.CONTENT_PATH,
          children: [bundle.XML_NAME, ...bundle.COMPONENTS],
        },
        {
          dirPath: join(bundle.TYPE_DIRECTORY, 'emptyComponent'),
          children: [], // Empty directory
        },
      ]);

      testUtil.stubAdapters([
        {
          type: registry.types.auradefinitionbundle,
          componentMappings: [
            {
              path: bundle.CONTENT_PATH,
              component: bundle.COMPONENT,
            },
          ],
        },
      ]);

      const components = resolver.getComponentsFromPath(bundle.TYPE_DIRECTORY);

      // Should only return the non-empty component
      expect(components).to.have.length(1);
      expect(components[0].name).to.equal('myComponent');
    });
  });
});
