/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { assert, expect } from 'chai';
import {
  MetadataResolver,
  SourceComponent,
  VirtualTreeContainer,
} from '../../src/metadata-registry';
import { nls } from '../../src/i18n';
import {
  mockRegistry,
  xmlInFolder,
  keanu,
  taraji,
  tina,
  simon,
  sean,
  gene,
  mockRegistryData,
} from '../mock/registry';
import { join, basename, dirname } from 'path';
import { TypeInferenceError } from '../../src/errors';
import { RegistryTestUtil } from './registryTestUtil';
import {
  REGINA_VIRTUAL_FS,
  REGINA_PATH,
  REGINA_COMPONENT,
  REGINA_CHILD_XML_PATH_1,
  REGINA_CHILD_COMPONENT_1,
  REGINA_XML_PATH,
  REGINA_CHILD_DIR_PATH,
  REGINA_CHILD_XML_PATH_2,
} from '../mock/registry/reginaConstants';
import {
  TARAJI_COMPONENT,
  TARAJI_CONTENT_PATH,
  TARAJI_DIR,
  TARAJI_VIRTUAL_FS,
  TARAJI_XML_PATHS,
} from '../mock/registry/tarajiConstants';

const testUtil = new RegistryTestUtil();

describe('MetadataResolver', () => {
  const resolver = new MetadataResolver(mockRegistry);

  describe('getComponentsFromPath', () => {
    afterEach(() => testUtil.restore());

    describe('File Paths', () => {
      it('Should throw file not found error if given path does not exist', () => {
        const path = keanu.KEANU_SOURCE_PATHS[0];

        assert.throws(
          () => resolver.getComponentsFromPath(path),
          TypeInferenceError,
          nls.localize('error_path_not_found', [path])
        );
      });

      it('Should determine type for metadata file with known suffix', () => {
        const path = keanu.KEANU_XML_PATHS[0];
        const access = testUtil.createMetadataResolver([
          {
            dirPath: keanu.KEANUS_DIR,
            children: [keanu.KEANU_SOURCE_NAMES[0], keanu.KEANU_XML_NAMES[0]],
          },
        ]);
        testUtil.stubAdapters([
          {
            type: mockRegistryData.types.keanureeves,
            componentMappings: [
              {
                path,
                component: keanu.KEANU_COMPONENT,
              },
            ],
          },
        ]);
        expect(access.getComponentsFromPath(path)).to.deep.equal([keanu.KEANU_COMPONENT]);
      });

      it('Should determine type for source file with known suffix', () => {
        const path = keanu.KEANU_SOURCE_PATHS[0];
        const access = testUtil.createMetadataResolver([
          {
            dirPath: keanu.KEANUS_DIR,
            children: [keanu.KEANU_SOURCE_NAMES[0], keanu.KEANU_XML_NAMES[0]],
          },
        ]);
        testUtil.stubAdapters([
          {
            type: mockRegistryData.types.keanureeves,
            componentMappings: [{ path, component: keanu.KEANU_COMPONENT }],
          },
        ]);
        expect(access.getComponentsFromPath(path)).to.deep.equal([keanu.KEANU_COMPONENT]);
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
        const path = keanu.KEANU_SOURCE_PATHS[0];
        const access = testUtil.createMetadataResolver([
          {
            dirPath: dirname(path),
            children: keanu.KEANU_SOURCE_NAMES,
          },
        ]);
        testUtil.stubAdapters([
          {
            type: mockRegistryData.types.keanureeves,
            componentMappings: [{ path, component: keanu.KEANU_CONTENT_COMPONENT }],
            allowContent: false,
          },
        ]);
        expect(access.getComponentsFromPath(path)).to.deep.equal([keanu.KEANU_CONTENT_COMPONENT]);
      });

      it('Should determine type for inFolder path content files', () => {
        const path = sean.SEAN_FOLDER;
        const access = testUtil.createMetadataResolver([
          {
            dirPath: path,
            children: sean.SEAN_NAMES,
          },
        ]);
        const componentMappings = sean.SEAN_PATHS.map((p: string, i: number) => ({
          path: p,
          component: sean.SEAN_COMPONENTS[i],
        }));
        testUtil.stubAdapters([
          {
            type: mockRegistryData.types.seanconnerys,
            componentMappings,
            allowContent: false,
          },
        ]);
        expect(access.getComponentsFromPath(path)).to.deep.equal(sean.SEAN_COMPONENTS);
      });

      it('Should determine type for folder files', () => {
        const path = gene.GENE_DIR;
        const access = testUtil.createMetadataResolver([
          {
            dirPath: path,
            children: [gene.GENE_FOLDER_XML_NAME],
          },
        ]);
        testUtil.stubAdapters([
          {
            type: mockRegistryData.types.genewilder,
            componentMappings: [
              { path: gene.GENE_FOLDER_XML_PATH, component: gene.GENE_FOLDER_COMPONENT },
            ],
            allowContent: false,
          },
        ]);
        expect(access.getComponentsFromPath(path)).to.deep.equal([gene.GENE_FOLDER_COMPONENT]);
      });

      it('Should not mistake folder component of a mixed content type as that type', () => {
        // this test has coveage on non-mixedContent types as well by nature of the execution path
        const path = tina.FOLDER_XML_PATH;
        const access = testUtil.createMetadataResolver([
          {
            dirPath: tina.TYPE_DIRECTORY,
            children: [basename(path)],
          },
        ]);
        testUtil.stubAdapters([
          {
            type: mockRegistryData.types.tinafeyfolder,
            componentMappings: [{ path, component: tina.FOLDER_COMPONENT }],
          },
        ]);
        expect(access.getComponentsFromPath(path)).to.deep.equal([tina.FOLDER_COMPONENT]);
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
        const path = keanu.KEANU_XML_PATHS[0];
        const access = testUtil.createMetadataResolver([
          {
            dirPath: dirname(path),
            children: [basename(path)],
          },
        ]);
        testUtil.stubForceIgnore({ seed: path, deny: [path] });
        testUtil.stubAdapters([
          {
            type: mockRegistryData.types.keanureeves,
            // should not be returned
            componentMappings: [{ path, component: keanu.KEANU_COMPONENT }],
          },
        ]);
        expect(access.getComponentsFromPath(path).length).to.equal(0);
      });

      it('Should not return a component if path to content metadata xml is forceignored', () => {
        const path = keanu.KEANU_XML_PATHS[0];
        const access = testUtil.createMetadataResolver([
          {
            dirPath: dirname(path),
            children: [basename(path)],
          },
        ]);
        testUtil.stubForceIgnore({ seed: path, deny: [path] });
        testUtil.stubAdapters([
          {
            type: mockRegistryData.types.keanureeves,
            // should not be returned
            componentMappings: [{ path, component: keanu.KEANU_COMPONENT }],
          },
        ]);
        expect(access.getComponentsFromPath(path).length).to.equal(0);
      });

      it('Should not return a component if path to folder metadata xml is forceignored', () => {
        const path = gene.GENE_FOLDER_XML_PATH;
        const access = testUtil.createMetadataResolver([
          {
            dirPath: dirname(path),
            children: [basename(path)],
          },
        ]);
        testUtil.stubForceIgnore({ seed: path, deny: [path] });
        testUtil.stubAdapters([
          {
            type: mockRegistryData.types.genewilder,
            // should not be returned
            componentMappings: [
              { path: gene.GENE_FOLDER_XML_PATH, component: gene.GENE_FOLDER_COMPONENT },
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
        const { KEANUS_DIR } = keanu;
        const stuffDir = join(KEANUS_DIR, 'hasStuff');
        const noStuffDir = join(KEANUS_DIR, 'noStuff');
        const kathyXml = join(KEANUS_DIR, xmlInFolder.XML_NAMES[0]);
        const keanuXml = keanu.KEANU_XML_PATHS[0];
        const keanuSrc = keanu.KEANU_SOURCE_PATHS[0];
        const keanuXml2 = join(stuffDir, keanu.KEANU_XML_NAMES[1]);
        const keanuSrc2 = join(stuffDir, keanu.KEANU_SOURCE_NAMES[1]);
        const tree = new VirtualTreeContainer([
          {
            dirPath: KEANUS_DIR,
            children: [
              basename(keanuXml),
              basename(keanuSrc),
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
            children: [basename(keanuSrc2), basename(keanuXml2)],
          },
        ]);
        const keanuComponent2: SourceComponent = new SourceComponent(
          {
            name: 'b',
            type: mockRegistryData.types.keanureeves,
            xml: keanuXml2,
            content: keanuSrc2,
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
                path: join(KEANUS_DIR, xmlInFolder.XML_NAMES[0]),
                component: kathyComponent2,
              },
            ],
          },
          {
            type: mockRegistryData.types.keanureeves,
            componentMappings: [
              {
                path: keanuXml,
                component: keanu.KEANU_COMPONENT,
              },
              {
                path: keanuXml2,
                component: keanuComponent2,
              },
            ],
          },
        ]);
        expect(access.getComponentsFromPath(KEANUS_DIR)).to.deep.equal([
          keanu.KEANU_COMPONENT,
          kathyComponent2,
          keanuComponent2,
        ]);
      });

      it('Should handle the folder of a mixed content folder type', () => {
        const access = testUtil.createMetadataResolver([
          {
            dirPath: tina.COMPONENT_FOLDER_PATH,
            children: tina.XML_NAMES.concat(tina.CONTENT_NAMES),
          },
        ]);
        testUtil.stubAdapters([
          {
            type: mockRegistryData.types.tinafey,
            componentMappings: [
              {
                path: tina.XML_PATHS[0],
                component: tina.COMPONENTS[0],
              },
              {
                path: tina.XML_PATHS[1],
                component: tina.COMPONENTS[1],
              },
            ],
          },
        ]);
        expect(access.getComponentsFromPath(tina.COMPONENT_FOLDER_PATH)).to.deep.equal([
          tina.COMPONENTS[0],
          tina.COMPONENTS[1],
        ]);
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
        const { SIMON_COMPONENT, SIMON_BUNDLE_PATH } = simon;
        const access = testUtil.createMetadataResolver([
          {
            dirPath: simon.SIMON_DIR,
            children: [basename(SIMON_BUNDLE_PATH)],
          },
          {
            dirPath: SIMON_BUNDLE_PATH,
            children: simon.SIMON_SOURCE_PATHS.concat(simon.SIMON_XML_PATH).map((p) => basename(p)),
          },
        ]);
        testUtil.stubAdapters([
          {
            type: mockRegistryData.types.simonpegg,
            componentMappings: [
              { path: simon.SIMON_BUNDLE_PATH, component: SIMON_COMPONENT },
              { path: simon.SIMON_XML_PATH, component: SIMON_COMPONENT },
              {
                path: simon.SIMON_SUBTYPE_PATH,
                component: SIMON_COMPONENT,
              },
            ],
          },
        ]);
        expect(access.getComponentsFromPath(simon.SIMON_DIR)).to.deep.equal([SIMON_COMPONENT]);
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
        const access = testUtil.createMetadataResolver(REGINA_VIRTUAL_FS);
        testUtil.stubAdapters([
          {
            type: mockRegistryData.types.reginaking,
            componentMappings: [
              { path: REGINA_XML_PATH, component: REGINA_COMPONENT },
              { path: REGINA_CHILD_XML_PATH_1, component: REGINA_CHILD_COMPONENT_1 },
            ],
          },
        ]);
        expect(access.getComponentsFromPath(REGINA_PATH)).to.deep.equal([REGINA_COMPONENT]);
      });

      it('should return expected child SourceComponent when given a subdirectory of a folderPerType component', () => {
        const tree = new VirtualTreeContainer(REGINA_VIRTUAL_FS);
        const access = testUtil.createMetadataResolver(REGINA_VIRTUAL_FS);
        const expectedComponent = new SourceComponent(REGINA_COMPONENT, tree);
        const children = expectedComponent.getChildren();
        const expectedChild = children.find((c) => c.xml === REGINA_CHILD_XML_PATH_2);
        expect(access.getComponentsFromPath(REGINA_CHILD_DIR_PATH)).to.deep.equal([expectedChild]);
      });

      /**
       * Because files of a mixed content type could have any suffix, they might collide
       * with a type that uses the "suffix index" in the registry and be assigned the incorrect type.
       *
       * Pretend that this bundle's root xml suffix is the same as KeanuReeves - still should be
       * identified as SimonPegg type
       */
      it('should handle suffix collision for mixed content types', () => {
        const tree = new VirtualTreeContainer([
          {
            dirPath: simon.SIMON_DIR,
            children: [basename(simon.SIMON_BUNDLE_PATH)],
          },
          {
            dirPath: simon.SIMON_BUNDLE_PATH,
            children: [keanu.KEANU_XML_NAMES[0], basename(simon.SIMON_SOURCE_PATHS[0])],
          },
        ]);
        const access = new MetadataResolver(mockRegistry, tree);
        expect(access.getComponentsFromPath(simon.SIMON_DIR)).to.deep.equal([
          new SourceComponent(
            {
              name: 'a',
              type: mockRegistryData.types.simonpegg,
              xml: join(simon.SIMON_BUNDLE_PATH, keanu.KEANU_XML_NAMES[0]),
              content: simon.SIMON_BUNDLE_PATH,
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
  });
});
