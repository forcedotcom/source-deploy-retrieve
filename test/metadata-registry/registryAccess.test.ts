/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { assert, expect } from 'chai';
import * as fs from 'fs';
import { createSandbox, SinonStub } from 'sinon';
import { MetadataComponent, SourcePath, MetadataType } from '../../src/types';
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
import * as fsUtil from '../../src/utils/fileSystemHandler';
import * as adapters from '../../src/metadata-registry/adapters';

const env = createSandbox();

let existsStub: SinonStub;
let isDirectoryStub: SinonStub;

function stubDirectories(
  structure: { directory: SourcePath; fileNames: SourcePath[] }[]
): void {
  const readDirStub: SinonStub = env.stub(fs, 'readdirSync');

  for (const part of structure) {
    existsStub.withArgs(part.directory).returns(true);
    isDirectoryStub.withArgs(part.directory).returns(true);
    for (const name of part.fileNames) {
      existsStub.withArgs(join(part.directory, name)).returns(true);
    }
    readDirStub.withArgs(part.directory).returns(part.fileNames);
  }
}

function stubAdapters(
  config: {
    type: MetadataType;
    componentMappings: { path: SourcePath; component: MetadataComponent }[];
  }[]
): void {
  const getAdapterStub = env.stub(adapters, 'getAdapter');
  for (const entry of config) {
    // @ts-ignore
    const adapterId = mockRegistry.adapters[entry.type.name.toLowerCase()];
    const componentMap: { [path: string]: MetadataComponent } = {};
    for (const c of entry.componentMappings) {
      componentMap[c.path] = c.component;
    }
    getAdapterStub.withArgs(entry.type, adapterId).returns({
      getComponent: (path: SourcePath) => componentMap[path]
    });
  }
}

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
    beforeEach(() => {
      existsStub = env.stub(fs, 'existsSync');
      isDirectoryStub = env.stub(fsUtil, 'isDirectory');
      isDirectoryStub.returns(false);
    });
    afterEach(() => env.restore());

    describe('File Paths', () => {
      it('Should throw file not found error if given path does not exist', () => {
        const path = keanu.KEANU_SOURCE_PATHS[0];
        existsStub.withArgs(path).returns(false);

        assert.throws(
          () => registry.getComponentsFromPath(path),
          TypeInferenceError,
          nls.localize('error_path_not_found', [path])
        );
      });

      it('Should determine type for metadata file with known suffix', () => {
        const path = keanu.KEANU_XML_PATHS[0];
        existsStub.withArgs(path).returns(true);
        stubAdapters([
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
        existsStub.withArgs(path).returns(true);
        stubAdapters([
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
        existsStub.withArgs(path).returns(true);
        stubAdapters([
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
        existsStub.withArgs(path).returns(true);
        stubAdapters([
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
        existsStub.withArgs(missing).returns(true);

        assert.throws(
          () => registry.getComponentsFromPath(missing),
          TypeInferenceError,
          nls.localize('error_could_not_infer_type', [missing])
        );
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
        stubDirectories([
          {
            directory: KATHY_FOLDER,
            fileNames: kathy.KATHY_XML_NAMES
          }
        ]);
        stubAdapters([
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
        existsStub.withArgs(KEANUS_DIR).returns(true);
        stubDirectories([
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
        stubAdapters([
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
        existsStub.withArgs(tina.TINA_FOLDER).returns(true);
        stubDirectories([
          {
            directory: tina.TINA_FOLDER,
            fileNames: tina.TINA_XML_NAMES.concat(tina.TINA_SOURCE_NAMES)
          }
        ]);
        stubAdapters([
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
        existsStub.withArgs(TARAJI_CONTENT_PATH).returns(true);
        stubDirectories([
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
        stubAdapters([
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
        stubDirectories([
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
        stubAdapters([
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
        existsStub.withArgs(simon.SIMON_DIR).returns(true);
        stubDirectories([
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
    });
  });
});
