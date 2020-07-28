/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { assert, expect } from 'chai';
import { RegistryAccess, SourceComponent, VirtualTreeContainer } from '../../src/metadata-registry';
import { nls } from '../../src/i18n';
import { mockRegistry, kathy, keanu, taraji, tina, simon } from '../mock/registry';
import { join, basename, dirname } from 'path';
import { TypeInferenceError } from '../../src/errors';
import { RegistryTestUtil } from './registryTestUtil';

const testUtil = new RegistryTestUtil();

describe('RegistryAccess', () => {
  const access = new RegistryAccess(mockRegistry);

  it('Should freeze the registry data parameter', () => {
    expect(Object.isFrozen(access.registry)).to.be.true;
    expect(Object.isFrozen(mockRegistry)).to.be.false;
  });

  describe('getTypeFromName', () => {
    it('Should fetch type regardless of casing', () => {
      expect(access.getTypeFromName('KeAnUReeVes')).to.deep.equal(mockRegistry.types.keanureeves);
    });

    it('Should fetch type regardless of spaces', () => {
      expect(access.getTypeFromName('kathy Bates')).to.deep.equal(mockRegistry.types.kathybates);
    });

    it('Should throw an error if definition missing', () => {
      assert.throws(
        () => access.getTypeFromName('TypeWithoutDef'),
        TypeInferenceError,
        nls.localize('error_missing_type_definition', mockRegistry.suffixes.missing)
      );
    });
  });

  describe('getComponentsFromPath', () => {
    afterEach(() => testUtil.restore());

    describe('File Paths', () => {
      it('Should throw file not found error if given path does not exist', () => {
        const path = keanu.KEANU_SOURCE_PATHS[0];

        assert.throws(
          () => access.getComponentsFromPath(path),
          TypeInferenceError,
          nls.localize('error_path_not_found', [path])
        );
      });

      it('Should determine type for metadata file with known suffix', () => {
        const path = keanu.KEANU_XML_PATHS[0];
        const access = testUtil.createRegistryAccess([
          {
            dirPath: keanu.KEANUS_DIR,
            children: [keanu.KEANU_SOURCE_NAMES[0], keanu.KEANU_XML_NAMES[0]],
          },
        ]);
        testUtil.stubAdapters([
          {
            type: mockRegistry.types.keanureeves,
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
        const access = testUtil.createRegistryAccess([
          {
            dirPath: keanu.KEANUS_DIR,
            children: [keanu.KEANU_SOURCE_NAMES[0], keanu.KEANU_XML_NAMES[0]],
          },
        ]);
        testUtil.stubAdapters([
          {
            type: mockRegistry.types.keanureeves,
            componentMappings: [{ path, component: keanu.KEANU_COMPONENT }],
          },
        ]);
        expect(access.getComponentsFromPath(path)).to.deep.equal([keanu.KEANU_COMPONENT]);
      });

      it('Should determine type for path of mixed content type', () => {
        const path = taraji.TARAJI_SOURCE_PATHS[1];
        const access = testUtil.createRegistryAccess([
          {
            dirPath: dirname(path),
            children: [basename(path)],
          },
        ]);
        testUtil.stubAdapters([
          {
            type: mockRegistry.types.tarajihenson,
            componentMappings: [{ path, component: taraji.TARAJI_COMPONENT }],
          },
        ]);
        expect(access.getComponentsFromPath(path)).to.deep.equal([taraji.TARAJI_COMPONENT]);
      });

      it('Should not mistake folder component of a mixed content type as that type', () => {
        // this test has coveage on non-mixedContent types as well by nature of the execution path
        const path = tina.TINA_FOLDER_XML;
        const access = testUtil.createRegistryAccess([
          {
            dirPath: tina.TINA_DIR,
            children: [basename(path)],
          },
        ]);
        testUtil.stubAdapters([
          {
            type: mockRegistry.types.tinafeyfolder,
            componentMappings: [{ path, component: tina.TINA_FOLDER_COMPONENT }],
          },
        ]);
        expect(access.getComponentsFromPath(path)).to.deep.equal([tina.TINA_FOLDER_COMPONENT]);
      });

      it('Should throw type id error if one could not be determined', () => {
        const missing = join('path', 'to', 'whatever', 'a.b-meta.xml');
        const access = testUtil.createRegistryAccess([
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
        const access = testUtil.createRegistryAccess([
          {
            dirPath: dirname(path),
            children: [basename(path)],
          },
        ]);
        testUtil.stubForceIgnore({ seed: path, deny: [path] });
        testUtil.stubAdapters([
          {
            type: mockRegistry.types.keanureeves,
            // should not be returned
            componentMappings: [{ path, component: keanu.KEANU_COMPONENT }],
          },
        ]);
        expect(access.getComponentsFromPath(path).length).to.equal(0);
      });
    });

    describe('Directory Paths', () => {
      it('Should return all components in a directory', () => {
        const access = testUtil.createRegistryAccess([
          {
            dirPath: kathy.KATHY_FOLDER,
            children: kathy.KATHY_XML_NAMES,
          },
        ]);
        const componentMappings = kathy.KATHY_XML_PATHS.map((p: string, i: number) => ({
          path: p,
          component: kathy.KATHY_COMPONENTS[i],
        }));
        testUtil.stubAdapters([
          {
            type: mockRegistry.types.kathybates,
            componentMappings,
          },
        ]);
        expect(access.getComponentsFromPath(kathy.KATHY_FOLDER)).to.deep.equal(
          kathy.KATHY_COMPONENTS
        );
      });

      it('Should walk all file and directory children', () => {
        const { KEANUS_DIR } = keanu;
        const stuffDir = join(KEANUS_DIR, 'hasStuff');
        const noStuffDir = join(KEANUS_DIR, 'noStuff');
        const kathyXml = join(KEANUS_DIR, kathy.KATHY_XML_NAMES[0]);
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
              kathy.KATHY_XML_NAMES[0],
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
            type: mockRegistry.types.keanureeves,
            xml: keanuXml2,
            content: keanuSrc2,
          },
          tree
        );
        const kathyComponent2 = new SourceComponent(
          {
            name: 'a',
            type: mockRegistry.types.kathybates,
            xml: kathyXml,
          },
          tree
        );
        const access = new RegistryAccess(mockRegistry, tree);
        testUtil.stubAdapters([
          {
            type: mockRegistry.types.kathybates,
            componentMappings: [
              {
                path: join(KEANUS_DIR, kathy.KATHY_XML_NAMES[0]),
                component: kathyComponent2,
              },
            ],
          },
          {
            type: mockRegistry.types.keanureeves,
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
        const access = testUtil.createRegistryAccess([
          {
            dirPath: tina.TINA_FOLDER,
            children: tina.TINA_XML_NAMES.concat(tina.TINA_SOURCE_NAMES),
          },
        ]);
        testUtil.stubAdapters([
          {
            type: mockRegistry.types.tinafey,
            componentMappings: [
              {
                path: tina.TINA_XML_PATHS[0],
                component: tina.TINA_COMPONENTS[0],
              },
              {
                path: tina.TINA_XML_PATHS[1],
                component: tina.TINA_COMPONENTS[1],
              },
            ],
          },
        ]);
        expect(access.getComponentsFromPath(tina.TINA_FOLDER)).to.deep.equal([
          tina.TINA_COMPONENTS[0],
          tina.TINA_COMPONENTS[1],
        ]);
      });

      it('Should return a component for a directory that is content or a child of content', () => {
        const { TARAJI_CONTENT_PATH } = taraji;
        const access = testUtil.createRegistryAccess([
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
            type: mockRegistry.types.tarajihenson,
            componentMappings: [
              {
                path: taraji.TARAJI_XML_PATHS[0],
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
        const access = testUtil.createRegistryAccess([
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
            type: mockRegistry.types.simonpegg,
            componentMappings: [
              { path: simon.SIMON_XML_PATH, component: SIMON_COMPONENT },
              {
                path: simon.SIMON_SUBTYPE_PATH,
                component: SIMON_COMPONENT,
              },
            ],
          },
        ]);
        expect(access.getComponentsFromPath(SIMON_BUNDLE_PATH)).to.deep.equal([SIMON_COMPONENT]);
      });

      /**
       * Because files of a mixed content type could have any suffix, they might collide
       * with a type that uses the "suffix index" in the registry and be assigned the incorrect type.
       *
       * Pretend that this bundle's root xml suffix is the same as KeanuReeves - still should be
       * identified as SimonPegg type
       */
      it('Should handle suffix collision for mixed content types', () => {
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
        const access = new RegistryAccess(mockRegistry, tree);
        expect(access.getComponentsFromPath(simon.SIMON_DIR)).to.deep.equal([
          new SourceComponent(
            {
              name: 'a',
              type: mockRegistry.types.simonpegg,
              xml: join(simon.SIMON_BUNDLE_PATH, keanu.KEANU_XML_NAMES[0]),
              content: simon.SIMON_BUNDLE_PATH,
            },
            tree
          ),
        ]);
      });

      it('Should not return components if the directory is forceignored', () => {
        const dirPath = kathy.KATHY_FOLDER;
        testUtil.stubForceIgnore({ seed: dirPath, deny: [dirPath] });
        const access = testUtil.createRegistryAccess([
          {
            dirPath,
            children: [kathy.KATHY_XML_NAMES[0], kathy.KATHY_XML_NAMES[1]],
          },
        ]);
        testUtil.stubAdapters([
          {
            type: mockRegistry.types.kathybates,
            componentMappings: [
              {
                path: kathy.KATHY_XML_PATHS[0],
                component: kathy.KATHY_COMPONENTS[0],
              },
              {
                path: kathy.KATHY_XML_PATHS[1],
                component: kathy.KATHY_COMPONENTS[1],
              },
            ],
          },
        ]);
        expect(access.getComponentsFromPath(dirPath).length).to.equal(0);
      });
    });
  });
});
