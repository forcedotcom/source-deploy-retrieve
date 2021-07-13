/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { assert, expect } from 'chai';
import { MetadataResolver, SourceComponent, VirtualTreeContainer } from '../../src/resolve';
import { nls } from '../../src/i18n';
import {
  mockRegistry,
  xmlInFolder,
  matchingContentFile,
  taraji,
  mixedContentInFolder,
  bundle,
  mockRegistryData,
  decomposedtoplevel,
} from '../mock/registry';
import { join, basename, dirname } from 'path';
import { TypeInferenceError } from '../../src/errors';
import { RegistryTestUtil } from './registryTestUtil';
import {
  DECOMPOSED_VIRTUAL_FS,
  DECOMPOSED_PATH,
  DECOMPOSED_COMPONENT,
  DECOMPOSED_CHILD_XML_PATH_1,
  DECOMPOSED_CHILD_COMPONENT_1,
  DECOMPOSED_XML_PATH,
  DECOMPOSED_CHILD_DIR_PATH,
  DECOMPOSED_CHILD_XML_PATH_2,
} from '../mock/registry/type-constants/decomposedConstants';
import {
  TARAJI_COMPONENT,
  TARAJI_CONTENT_PATH,
  TARAJI_DIR,
  TARAJI_VIRTUAL_FS,
  TARAJI_XML_PATHS,
} from '../mock/registry/type-constants/tarajiConstants';
import { ComponentSet } from '../../src';

const testUtil = new RegistryTestUtil();

describe('MetadataResolver', () => {
  const resolver = new MetadataResolver(mockRegistry);

  describe('getComponentsFromPath', () => {
    afterEach(() => testUtil.restore());

    describe('File Paths', () => {
      it('Should throw file not found error if given path does not exist', () => {
        const path = matchingContentFile.CONTENT_PATHS[0];

        assert.throws(
          () => resolver.getComponentsFromPath(path),
          TypeInferenceError,
          nls.localize('error_path_not_found', [path])
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
            type: mockRegistryData.types.matchingcontentfile,
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
            type: mockRegistryData.types.matchingcontentfile,
            componentMappings: [{ path, component: matchingContentFile.COMPONENT }],
          },
        ]);
        expect(access.getComponentsFromPath(path)).to.deep.equal([matchingContentFile.COMPONENT]);
      });

      it('Should determine type for path of mixed content type', () => {
        const path = taraji.TARAJI_SOURCE_PATHS[1];
        const access = testUtil.createMetadataResolver([
          {
            dirPath: dirname(path),
            children: [basename(path)],
          },
        ]);
        testUtil.stubAdapters([
          {
            type: mockRegistryData.types.tarajihenson,
            componentMappings: [{ path, component: taraji.TARAJI_COMPONENT }],
          },
        ]);
        expect(access.getComponentsFromPath(path)).to.deep.equal([taraji.TARAJI_COMPONENT]);
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
            type: mockRegistryData.types.matchingcontentfile,
            componentMappings: [{ path, component: matchingContentFile.CONTENT_COMPONENT }],
            allowContent: false,
          },
        ]);
        expect(access.getComponentsFromPath(path)).to.deep.equal([
          matchingContentFile.CONTENT_COMPONENT,
        ]);
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
          path: c.xml,
          component: c,
        }));
        testUtil.stubAdapters([
          {
            type: mockRegistryData.types.xmlinfolder,
            componentMappings,
            allowContent: false,
          },
        ]);
        expect(access.getComponentsFromPath(path)).to.deep.equal(xmlInFolder.COMPONENTS);
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
            type: mockRegistryData.types.xmlinfolderfolder,
            componentMappings: [
              { path: xmlInFolder.FOLDER_XML_PATH, component: xmlInFolder.FOLDER_COMPONENT },
            ],
            allowContent: false,
          },
        ]);
        expect(access.getComponentsFromPath(path)).to.deep.equal([xmlInFolder.FOLDER_COMPONENT]);
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
            type: mockRegistryData.types.mciffolder,
            componentMappings: [{ path, component: mixedContentInFolder.FOLDER_COMPONENT }],
          },
        ]);
        expect(access.getComponentsFromPath(path)).to.deep.equal([
          mixedContentInFolder.FOLDER_COMPONENT,
        ]);
      });

      it('Should throw type id error if one could not be determined', () => {
        const missing = join('path', 'to', 'whatever', 'a.b-meta.xml');
        const access = testUtil.createMetadataResolver([
          {
            dirPath: dirname(missing),
            children: [basename(missing)],
          },
        ]);
        assert.throws(
          () => access.getComponentsFromPath(missing),
          TypeInferenceError,
          nls.localize('error_could_not_infer_type', [missing])
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
            type: mockRegistryData.types.matchingcontentfile,
            // should not be returned
            componentMappings: [{ path, component: matchingContentFile.COMPONENT }],
          },
        ]);
        expect(access.getComponentsFromPath(path).length).to.equal(0);
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
            type: mockRegistryData.types.matchingcontentfile,
            // should not be returned
            componentMappings: [{ path, component: matchingContentFile.COMPONENT }],
          },
        ]);
        expect(access.getComponentsFromPath(path).length).to.equal(0);
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
            type: mockRegistryData.types.xmlinfolder,
            // should not be returned
            componentMappings: [
              { path: xmlInFolder.FOLDER_XML_PATH, component: xmlInFolder.FOLDER_COMPONENT },
            ],
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
            type: mockRegistryData.types.xmlinfolder,
            componentMappings,
          },
        ]);
        expect(resolver.getComponentsFromPath(xmlInFolder.COMPONENT_FOLDER_PATH)).to.deep.equal(
          xmlInFolder.COMPONENTS
        );
      });

      it('Should walk all file and directory children', () => {
        const { TYPE_DIRECTORY: MCF_DIR } = matchingContentFile;
        const stuffDir = join(MCF_DIR, 'hasStuff');
        const noStuffDir = join(MCF_DIR, 'noStuff');
        const kathyXml = join(MCF_DIR, xmlInFolder.XML_NAMES[0]);
        const mcfXml = matchingContentFile.XML_PATHS[0];
        const mcfContent = matchingContentFile.CONTENT_PATHS[0];
        const mcfXml2 = join(stuffDir, matchingContentFile.XML_NAMES[1]);
        const mcfContent2 = join(stuffDir, matchingContentFile.CONTENT_NAMES[1]);
        const tree = new VirtualTreeContainer([
          {
            dirPath: MCF_DIR,
            children: [
              basename(mcfXml),
              basename(mcfContent),
              xmlInFolder.XML_NAMES[0],
              'hasStuff',
              'noStuff',
            ],
          },
          {
            dirPath: noStuffDir,
            children: [],
          },
          {
            dirPath: stuffDir,
            children: [basename(mcfContent2), basename(mcfXml2)],
          },
        ]);
        const mcfComponent2: SourceComponent = new SourceComponent(
          {
            name: 'b',
            type: mockRegistryData.types.matchingcontentfile,
            xml: mcfXml2,
            content: mcfContent2,
          },
          tree
        );
        const kathyComponent2 = new SourceComponent(
          {
            name: 'a',
            type: mockRegistryData.types.xmlinfolder,
            xml: kathyXml,
          },
          tree
        );
        const access = new MetadataResolver(mockRegistry, tree);
        testUtil.stubAdapters([
          {
            type: mockRegistryData.types.xmlinfolder,
            componentMappings: [
              {
                path: join(MCF_DIR, xmlInFolder.XML_NAMES[0]),
                component: kathyComponent2,
              },
            ],
          },
          {
            type: mockRegistryData.types.matchingcontentfile,
            componentMappings: [
              {
                path: mcfXml,
                component: matchingContentFile.COMPONENT,
              },
              {
                path: mcfXml2,
                component: mcfComponent2,
              },
            ],
          },
        ]);
        expect(access.getComponentsFromPath(MCF_DIR)).to.deep.equal([
          matchingContentFile.COMPONENT,
          kathyComponent2,
          mcfComponent2,
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
            type: mockRegistryData.types.mixedcontentinfolder,
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
        expect(
          access.getComponentsFromPath(mixedContentInFolder.COMPONENT_FOLDER_PATH)
        ).to.deep.equal([mixedContentInFolder.COMPONENTS[0], mixedContentInFolder.COMPONENTS[1]]);
      });

      it('Should return a component for a directory that is content or a child of content', () => {
        const { TARAJI_CONTENT_PATH } = taraji;
        const access = testUtil.createMetadataResolver([
          {
            dirPath: TARAJI_CONTENT_PATH,
            children: [],
          },
          {
            dirPath: taraji.TARAJI_DIR,
            children: [taraji.TARAJI_XML_NAMES[0], basename(TARAJI_CONTENT_PATH)],
          },
        ]);
        testUtil.stubAdapters([
          {
            type: mockRegistryData.types.tarajihenson,
            componentMappings: [
              {
                path: TARAJI_CONTENT_PATH,
                component: taraji.TARAJI_COMPONENT,
              },
            ],
          },
        ]);
        expect(access.getComponentsFromPath(TARAJI_CONTENT_PATH)).to.deep.equal([
          taraji.TARAJI_COMPONENT,
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
            type: mockRegistryData.types.bundle,
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
        const access = testUtil.createMetadataResolver(TARAJI_VIRTUAL_FS);
        const component = SourceComponent.createVirtualComponent(
          TARAJI_COMPONENT,
          TARAJI_VIRTUAL_FS
        );
        testUtil.stubAdapters([
          {
            type: mockRegistryData.types.tarajihenson,
            componentMappings: [
              { path: TARAJI_CONTENT_PATH, component },
              { path: TARAJI_XML_PATHS[0], component },
            ],
          },
        ]);

        expect(access.getComponentsFromPath(TARAJI_DIR)).to.deep.equal([component]);
      });

      it('should stop resolution if parent component is resolved', () => {
        const access = testUtil.createMetadataResolver(DECOMPOSED_VIRTUAL_FS);
        testUtil.stubAdapters([
          {
            type: mockRegistryData.types.decomposed,
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
        expect(access.getComponentsFromPath(DECOMPOSED_CHILD_DIR_PATH)).to.deep.equal([
          expectedChild,
        ]);
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
        const access = new MetadataResolver(mockRegistry, tree);
        expect(access.getComponentsFromPath(bundle.TYPE_DIRECTORY)).to.deep.equal([
          new SourceComponent(
            {
              name: 'a',
              type: mockRegistryData.types.bundle,
              xml: join(bundle.CONTENT_PATH, matchingContentFile.XML_NAMES[0]),
              content: bundle.CONTENT_PATH,
            },
            tree
          ),
        ]);
      });

      it('should not return components if the directory is forceignored', () => {
        const dirPath = xmlInFolder.COMPONENT_FOLDER_PATH;
        testUtil.stubForceIgnore({ seed: dirPath, deny: [dirPath] });
        const access = testUtil.createMetadataResolver([
          {
            dirPath,
            children: [xmlInFolder.XML_NAMES[0], xmlInFolder.XML_NAMES[1]],
          },
        ]);
        testUtil.stubAdapters([
          {
            type: mockRegistryData.types.xmlinfolder,
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

    describe('Filtering', () => {
      it('should only return components present in filter', async () => {
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
            type: mockRegistryData.types.xmlinfolder,
            componentMappings,
          },
        ]);
        const toFilter = {
          fullName: xmlInFolder.COMPONENTS[0].fullName,
          type: mockRegistryData.types.xmlinfolder,
        };
        const filter = new ComponentSet([toFilter]);

        const result = resolver.getComponentsFromPath(xmlInFolder.COMPONENT_FOLDER_PATH, filter);

        expect(result).to.deep.equal([xmlInFolder.COMPONENTS[0]]);
      });

      it('should resolve child components when present in filter', async () => {
        const resolver = testUtil.createMetadataResolver(decomposedtoplevel.DECOMPOSED_VIRTUAL_FS);
        const children = decomposedtoplevel.DECOMPOSED_TOP_LEVEL_COMPONENT.getChildren();
        const componentMappings = children.map((c: SourceComponent) => ({
          path: c.xml,
          component: c,
        }));
        componentMappings.push({
          path: decomposedtoplevel.DECOMPOSED_TOP_LEVEL_XML_PATH,
          component: decomposedtoplevel.DECOMPOSED_TOP_LEVEL_COMPONENT,
        });
        testUtil.stubAdapters([
          {
            type: mockRegistryData.types.decomposedtoplevel,
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

        const result = resolver.getComponentsFromPath(
          decomposedtoplevel.DECOMPOSED_TOP_LEVEL_COMPONENT_PATH,
          filter
        );

        expect(result).to.deep.equal(children);
      });

      it('should resolve directory component if in filter', () => {
        const resolver = new MetadataResolver(mockRegistry, bundle.COMPONENT.tree);
        testUtil.stubAdapters([
          {
            type: mockRegistryData.types.bundle,
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
            type: mockRegistryData.types.bundle,
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
  });
});
