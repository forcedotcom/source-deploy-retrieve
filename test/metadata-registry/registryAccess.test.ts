/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { assert, expect } from 'chai';
import { MetadataComponent } from '../../src/types';
import { RegistryAccess } from '../../src/metadata-registry';
import { nls } from '../../src/i18n';
import {
  mockRegistry,
  kathy,
  keanu,
  taraji,
  tina,
  simon
} from '../mock/registry';
import { join, basename } from 'path';
import { TypeInferenceError } from '../../src/errors';
import { RegistryTestUtil } from './registryTestUtil';

const testUtil = new RegistryTestUtil();

describe('RegistryAccess', () => {
  const registry = new RegistryAccess(mockRegistry);

  it('Should freeze the registry data parameter', () => {
    expect(Object.isFrozen(registry.data)).to.be.true;
    expect(Object.isFrozen(mockRegistry)).to.be.false;
  });

  describe('getTypeFromName', () => {
    it('Should fetch type regardless of casing', () => {
      expect(registry.getTypeFromName('KeAnUReeVes')).to.deep.equal(
        mockRegistry.types.keanureeves
      );
    });

    it('Should fetch type regardless of spaces', () => {
      expect(registry.getTypeFromName('kathy Bates')).to.deep.equal(
        mockRegistry.types.kathybates
      );
    });

    it('Should throw an error if definition missing', () => {
      assert.throws(
        () => registry.getTypeFromName('TypeWithoutDef'),
        TypeInferenceError,
        nls.localize(
          'error_missing_type_definition',
          mockRegistry.suffixes.missing
        )
      );
    });
  });

  describe('getComponentsFromPath', () => {
    beforeEach(() => testUtil.initStubs());
    afterEach(() => testUtil.restore());

    describe('File Paths', () => {
      it('Should throw file not found error if given path does not exist', () => {
        const path = keanu.KEANU_SOURCE_PATHS[0];
        testUtil.exists(path, false);

        assert.throws(
          () => registry.getComponentsFromPath(path),
          TypeInferenceError,
          nls.localize('error_path_not_found', [path])
        );
      });

      it('Should determine type for metadata file with known suffix', () => {
        const path = keanu.KEANU_XML_PATHS[0];
        testUtil.exists(path, true);
        testUtil.stubAdapters([
          {
            type: mockRegistry.types.keanureeves,
            componentMappings: [
              {
                path,
                component: keanu.KEANU_COMPONENT
              }
            ]
          }
        ]);
        expect(registry.getComponentsFromPath(path)).to.deep.equal([
          keanu.KEANU_COMPONENT
        ]);
      });

      it('Should determine type for source file with known suffix', () => {
        const path = keanu.KEANU_SOURCE_PATHS[0];
        testUtil.exists(path, true);
        testUtil.stubAdapters([
          {
            type: mockRegistry.types.keanureeves,
            componentMappings: [{ path, component: keanu.KEANU_COMPONENT }]
          }
        ]);
        expect(registry.getComponentsFromPath(path)).to.deep.equal([
          keanu.KEANU_COMPONENT
        ]);
      });

      it('Should determine type for path of mixed content type', () => {
        const path = taraji.TARAJI_SOURCE_PATHS[1];
        testUtil.exists(path, true);
        testUtil.stubAdapters([
          {
            type: mockRegistry.types.tarajihenson,
            componentMappings: [{ path, component: taraji.TARAJI_COMPONENT }]
          }
        ]);

        expect(registry.getComponentsFromPath(path)).to.deep.equal([
          taraji.TARAJI_COMPONENT
        ]);
      });

      it('Should not mistake folder component of a mixed content type as that type', () => {
        // this test has coveage on non-mixedContent types as well by nature of the execution path
        const path = tina.TINA_FOLDER_XML;
        testUtil.exists(path, true);
        testUtil.stubAdapters([
          {
            type: mockRegistry.types.tinafeyfolder,
            componentMappings: [{ path, component: tina.TINA_FOLDER_COMPONENT }]
          }
        ]);
        expect(registry.getComponentsFromPath(path)).to.deep.equal([
          tina.TINA_FOLDER_COMPONENT
        ]);
      });

      it('Should throw type id error if one could not be determined', () => {
        const missing = join('path', 'to', 'whatever', 'a.b-meta.xml');
        testUtil.exists(missing, true);

        assert.throws(
          () => registry.getComponentsFromPath(missing),
          TypeInferenceError,
          nls.localize('error_could_not_infer_type', [missing])
        );
      });

      it('Should not return a component if path to metadata xml is forceignored', () => {
        const path = keanu.KEANU_XML_PATHS[0];
        testUtil.exists(path, true);
        testUtil.stubForceIgnore({ seed: path, deny: [path] });
        testUtil.stubAdapters([
          {
            type: mockRegistry.types.keanureeves,
            // should not be returned
            componentMappings: [{ path, component: keanu.KEANU_COMPONENT }]
          }
        ]);
        expect(registry.getComponentsFromPath(path).length).to.equal(0);
      });
    });

    describe('Directory Paths', () => {
      it('Should return all components in a directory', () => {
        const { KATHY_FOLDER, KATHY_COMPONENTS } = kathy;
        const componentMappings = kathy.KATHY_XML_PATHS.map(
          (p: string, i: number) => ({
            path: p,
            component: KATHY_COMPONENTS[i]
          })
        );
        testUtil.stubDirectories([
          {
            directory: KATHY_FOLDER,
            fileNames: kathy.KATHY_XML_NAMES
          }
        ]);
        testUtil.stubAdapters([
          {
            type: mockRegistry.types.kathybates,
            componentMappings
          }
        ]);
        expect(registry.getComponentsFromPath(KATHY_FOLDER)).to.deep.equal(
          KATHY_COMPONENTS
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
        const keanuComponent2: MetadataComponent = {
          fullName: 'b',
          type: mockRegistry.types.keanureeves,
          xml: keanuXml2,
          sources: [keanuSrc2]
        };
        const kathyComponent2: MetadataComponent = {
          fullName: 'a',
          type: mockRegistry.types.kathybates,
          xml: kathyXml,
          sources: []
        };
        testUtil.exists(KEANUS_DIR, true);
        testUtil.stubDirectories([
          {
            directory: KEANUS_DIR,
            fileNames: [
              basename(keanuXml),
              basename(keanuSrc),
              kathy.KATHY_XML_NAMES[0],
              'hasStuff',
              'noStuff'
            ]
          },
          {
            directory: noStuffDir,
            fileNames: []
          },
          {
            directory: stuffDir,
            fileNames: [basename(keanuSrc2), basename(keanuXml2)]
          }
        ]);
        testUtil.stubAdapters([
          {
            type: mockRegistry.types.kathybates,
            componentMappings: [
              {
                path: join(KEANUS_DIR, kathy.KATHY_XML_NAMES[0]),
                component: kathyComponent2
              }
            ]
          },
          {
            type: mockRegistry.types.keanureeves,
            componentMappings: [
              {
                path: keanuXml,
                component: keanu.KEANU_COMPONENT
              },
              {
                path: keanuXml2,
                component: keanuComponent2
              }
            ]
          }
        ]);
        expect(registry.getComponentsFromPath(KEANUS_DIR)).to.deep.equal([
          keanu.KEANU_COMPONENT,
          kathyComponent2,
          keanuComponent2
        ]);
      });

      it('Should handle the folder of a mixed content folder type', () => {
        testUtil.exists(tina.TINA_FOLDER, true);
        testUtil.stubDirectories([
          {
            directory: tina.TINA_FOLDER,
            fileNames: tina.TINA_XML_NAMES.concat(tina.TINA_SOURCE_NAMES)
          }
        ]);
        testUtil.stubAdapters([
          {
            type: mockRegistry.types.tinafey,
            componentMappings: [
              {
                path: tina.TINA_XML_PATHS[0],
                component: tina.TINA_COMPONENTS[0]
              },
              {
                path: tina.TINA_XML_PATHS[1],
                component: tina.TINA_COMPONENTS[1]
              }
            ]
          }
        ]);
        expect(registry.getComponentsFromPath(tina.TINA_FOLDER)).to.deep.equal([
          tina.TINA_COMPONENTS[0],
          tina.TINA_COMPONENTS[1]
        ]);
      });

      it('Should return a component for a directory that is content or a child of content', () => {
        const { TARAJI_CONTENT_PATH } = taraji;
        testUtil.exists(TARAJI_CONTENT_PATH, true);
        testUtil.stubDirectories([
          {
            directory: TARAJI_CONTENT_PATH,
            fileNames: []
          },
          {
            directory: taraji.TARAJI_DIR,
            fileNames: [
              taraji.TARAJI_XML_NAMES[0],
              basename(TARAJI_CONTENT_PATH)
            ]
          }
        ]);
        testUtil.stubAdapters([
          {
            type: mockRegistry.types.tarajihenson,
            componentMappings: [
              {
                path: taraji.TARAJI_XML_PATHS[0],
                component: taraji.TARAJI_COMPONENT
              }
            ]
          }
        ]);
        expect(
          registry.getComponentsFromPath(TARAJI_CONTENT_PATH)
        ).to.deep.equal([taraji.TARAJI_COMPONENT]);
      });

      it('Should not add duplicates of a component when the content has multiple -meta.xmls', () => {
        const { SIMON_COMPONENT, SIMON_BUNDLE_PATH } = simon;
        testUtil.stubDirectories([
          {
            directory: simon.SIMON_DIR,
            fileNames: [basename(SIMON_BUNDLE_PATH)]
          },
          {
            directory: SIMON_BUNDLE_PATH,
            fileNames: simon.SIMON_SOURCE_PATHS.concat(
              simon.SIMON_XML_PATH
            ).map(p => basename(p))
          }
        ]);
        testUtil.stubAdapters([
          {
            type: mockRegistry.types.simonpegg,
            componentMappings: [
              { path: simon.SIMON_XML_PATH, component: SIMON_COMPONENT },
              {
                path: simon.SIMON_SUBTYPE_PATH,
                component: SIMON_COMPONENT
              }
            ]
          }
        ]);
        expect(registry.getComponentsFromPath(SIMON_BUNDLE_PATH)).to.deep.equal(
          [SIMON_COMPONENT]
        );
      });

      /**
       * Because files of a mixed content type could have any suffix, they might collide
       * with a type that uses the "suffix index" in the registry and be assigned the incorrect type.
       *
       * Pretend that this bundle's root xml suffix is the same as KeanuReeves - still should be
       * identified as SimonPegg type
       */
      it('Should handle suffix collision for mixed content types', () => {
        testUtil.exists(simon.SIMON_DIR, true);
        testUtil.stubDirectories([
          {
            directory: simon.SIMON_DIR,
            fileNames: [basename(simon.SIMON_BUNDLE_PATH)]
          },
          {
            directory: simon.SIMON_BUNDLE_PATH,
            fileNames: [
              keanu.KEANU_XML_NAMES[0],
              basename(simon.SIMON_SOURCE_PATHS[0])
            ]
          }
        ]);
        expect(registry.getComponentsFromPath(simon.SIMON_DIR)).to.deep.equal([
          {
            fullName: 'a',
            type: mockRegistry.types.simonpegg,
            xml: join(simon.SIMON_BUNDLE_PATH, keanu.KEANU_XML_NAMES[0]),
            sources: [simon.SIMON_SOURCE_PATHS[0]]
          }
        ]);
      });

      it('Should not return components if the directory is forceignored', () => {
        const path = kathy.KATHY_FOLDER;
        testUtil.stubForceIgnore({ seed: path, deny: [path] });
        testUtil.stubDirectories([
          {
            directory: path,
            fileNames: [kathy.KATHY_XML_NAMES[0], kathy.KATHY_XML_NAMES[1]]
          }
        ]);
        testUtil.stubAdapters([
          {
            type: mockRegistry.types.kathybates,
            componentMappings: [
              {
                path: kathy.KATHY_XML_PATHS[0],
                component: kathy.KATHY_COMPONENTS[0]
              },
              {
                path: kathy.KATHY_XML_PATHS[1],
                component: kathy.KATHY_COMPONENTS[1]
              }
            ]
          }
        ]);
        expect(registry.getComponentsFromPath(path).length).to.equal(0);
      });
    });
  });
});
