/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { assert, expect } from 'chai';
import * as fs from 'fs';
import { createSandbox, SinonStub } from 'sinon';
import {
  RegistryAccess,
  SourcePath,
  MetadataComponent
} from '../../src/metadata-registry';
import { nls } from '../../src/i18n';
// TODO: this import statement makes me vomit
import {
  mockRegistry,
  KEANU_SOURCE,
  KEANU_XML,
  KEANU_COMPONENT,
  TARAJI_SOURCE_2,
  TARAJI_COMPONENT,
  KATHY_XML,
  KATHY_XML_2,
  KATHY_XML_3,
  KATHY_COMPONENT,
  KATHY_COMPONENT_2,
  KATHY_COMPONENT_3,
  KEANUS_DIR,
  TARAJI_CONTENT,
  TARAJI_DIR,
  TARAJI_XML,
  KATHY_FOLDER,
  TINA_FOLDER,
  TINA_XML,
  TINA_SOURCE,
  TINA_XML_2,
  TINA_SOURCE_2,
  TINA_COMPONENT,
  TINA_COMPONENT_2,
  SIMON_BUNDLE,
  SIMON_COMPONENT,
  SIMON_XML,
  SIMON_SUBTYPE,
  SIMON_SOURCE_1,
  SIMON_SOURCE_2,
  SIMON_SOURCE_3
} from '../mock/registry';
import { join, basename } from 'path';
import { TypeInferenceError } from '../../src/errors';
import * as util from '../../src/metadata-registry/util';
import * as adapters from '../../src/metadata-registry/adapters';

const env = createSandbox();

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
    let existsStub: SinonStub;
    let directoryStub: SinonStub;
    let getAdapterStub: SinonStub;

    beforeEach(() => {
      existsStub = env.stub(fs, 'existsSync');
      directoryStub = env.stub(util, 'isDirectory').returns(false);
      getAdapterStub = env.stub(adapters, 'getAdapter');
    });
    afterEach(() => env.restore());

    describe('File Paths', () => {
      it('Should throw file not found error if given path does not exist', () => {
        existsStub.withArgs(KEANU_SOURCE).returns(false);

        assert.throws(
          () => registry.getComponentsFromPath(KEANU_SOURCE),
          TypeInferenceError,
          nls.localize('error_path_not_found', [KEANU_SOURCE])
        );
      });

      it('Should determine type for metadata file with known suffix', () => {
        existsStub.withArgs(KEANU_XML).returns(true);
        directoryStub.withArgs(KEANU_XML).returns(false);
        getAdapterStub
          .withArgs(
            mockRegistry.types.keanureeves,
            mockRegistry.adapters.keanureeves
          )
          .returns({
            getComponent: () => KEANU_COMPONENT
          });

        expect(registry.getComponentsFromPath(KEANU_XML)).to.deep.equal([
          KEANU_COMPONENT
        ]);
      });

      it('Should determine type for source file with known suffix', () => {
        existsStub.withArgs(KEANU_SOURCE).returns(true);
        directoryStub.withArgs(KEANU_SOURCE).returns(false);
        getAdapterStub
          .withArgs(
            mockRegistry.types.keanureeves,
            mockRegistry.adapters.keanureeves
          )
          .returns({
            getComponent: () => KEANU_COMPONENT
          });

        expect(registry.getComponentsFromPath(KEANU_SOURCE)).to.deep.equal([
          KEANU_COMPONENT
        ]);
      });

      it('Should determine type for path of mixed content type', () => {
        existsStub.withArgs(TARAJI_SOURCE_2).returns(true);
        directoryStub.withArgs(TARAJI_SOURCE_2).returns(false);
        getAdapterStub
          .withArgs(
            mockRegistry.types.tarajihenson,
            mockRegistry.adapters.tarajihenson
          )
          .returns({
            getComponent: () => TARAJI_COMPONENT
          });

        expect(registry.getComponentsFromPath(TARAJI_SOURCE_2)).to.deep.equal([
          TARAJI_COMPONENT
        ]);
      });

      it('Should throw type id error if one could not be determined', () => {
        const missing = join('path', 'to', 'whatever', 'a.b-meta.xml');
        existsStub.withArgs(missing).returns(true);
        directoryStub.withArgs(missing).returns(false);

        assert.throws(
          () => registry.getComponentsFromPath(missing),
          TypeInferenceError,
          nls.localize('error_could_not_infer_type', [missing])
        );
      });
    });

    // TODO: Tidy these fools up. and those imports are digusting bruh fix those too.
    // make a utility or something dang.
    describe('Directory Paths', () => {
      let readDirStub: SinonStub;

      beforeEach(() => (readDirStub = env.stub(fs, 'readdirSync')));

      it('Should return all components in a directory', () => {
        const fileNames = [KATHY_XML, KATHY_XML_2, KATHY_XML_3].map(p =>
          basename(p)
        );
        existsStub.withArgs(KATHY_FOLDER).returns(true);
        directoryStub.withArgs(KATHY_FOLDER).returns(true);
        readDirStub.withArgs(KATHY_FOLDER).returns(fileNames);
        getAdapterStub
          .withArgs(mockRegistry.types.kathybates, undefined)
          .returns({
            getComponent: (path: SourcePath) => {
              switch (path) {
                case KATHY_XML:
                  return KATHY_COMPONENT;
                case KATHY_XML_2:
                  return KATHY_COMPONENT_2;
                case KATHY_XML_3:
                  return KATHY_COMPONENT_3;
              }
            }
          });
        expect(registry.getComponentsFromPath(KATHY_FOLDER)).to.deep.equal([
          KATHY_COMPONENT,
          KATHY_COMPONENT_2,
          KATHY_COMPONENT_3
        ]);
      });

      it('Should walk all file and directory children', () => {
        const STUFF_DIR = join(KEANUS_DIR, 'hasStuff');
        const NO_STUFF_DIR = join(KEANUS_DIR, 'noStuff');
        const KEANU_COMPONENT_2: MetadataComponent = {
          fullName: 'b',
          type: mockRegistry.types.keanureeves,
          xml: join(STUFF_DIR, 'b.keanu-meta.xml'),
          sources: [join(STUFF_DIR, 'b.keanu')]
        };
        const KATHY_COMPONENT_2: MetadataComponent = {
          fullName: 'a',
          type: mockRegistry.types.kathybates,
          xml: join(KEANUS_DIR, 'a.kathy-meta.xml'),
          sources: []
        };
        existsStub.withArgs(KEANUS_DIR).returns(true);
        readDirStub
          .withArgs(KEANUS_DIR)
          .returns([
            'a.keanu-meta.xml',
            'a.keanu',
            'a.kathy-meta.xml',
            'hasStuff',
            'noStuff'
          ]);
        readDirStub.withArgs(NO_STUFF_DIR).returns([]);
        readDirStub
          .withArgs(STUFF_DIR)
          .returns(['b.keanu-meta.xml', 'b.keanu']);
        directoryStub.withArgs(KEANUS_DIR).returns(true);
        directoryStub.withArgs(STUFF_DIR).returns(true);
        directoryStub.withArgs(NO_STUFF_DIR).returns(true);
        getAdapterStub
          .withArgs(mockRegistry.types.kathybates, undefined)
          .returns({
            getComponent: (path: SourcePath) => {
              if (path === join(KEANUS_DIR, 'a.kathy-meta.xml')) {
                const sources: string[] = [];
                return {
                  fullName: 'a',
                  type: mockRegistry.types.kathybates,
                  xml: join(KEANUS_DIR, 'a.kathy-meta.xml'),
                  sources
                };
              }
            }
          });
        getAdapterStub
          .withArgs(
            mockRegistry.types.keanureeves,
            mockRegistry.adapters.keanureeves
          )
          .returns({
            getComponent: (path: SourcePath) => {
              switch (path) {
                case KEANU_XML:
                  return KEANU_COMPONENT;
                case join(STUFF_DIR, 'b.keanu-meta.xml'):
                  return KEANU_COMPONENT_2;
              }
            }
          });
        expect(registry.getComponentsFromPath(KEANUS_DIR)).to.deep.equal([
          KEANU_COMPONENT,
          KATHY_COMPONENT_2,
          KEANU_COMPONENT_2
        ]);
      });

      it('Should handle the folder of a mixed content folder type', () => {
        existsStub.withArgs(TINA_FOLDER).returns(true);
        directoryStub.withArgs(TINA_FOLDER).returns(true);
        const filenames = [
          TINA_XML,
          TINA_SOURCE,
          TINA_XML_2,
          TINA_SOURCE_2
        ].map(f => basename(f));
        readDirStub.withArgs(TINA_FOLDER).returns(filenames);
        getAdapterStub
          .withArgs(mockRegistry.types.tinafey, mockRegistry.adapters.tinafey)
          .returns({
            getComponent: (path: SourcePath) => {
              switch (path) {
                case TINA_XML:
                  return TINA_COMPONENT;
                case TINA_XML_2:
                  return TINA_COMPONENT_2;
              }
            }
          });
        expect(registry.getComponentsFromPath(TINA_FOLDER)).to.deep.equal([
          TINA_COMPONENT,
          TINA_COMPONENT_2
        ]);
      });

      it('Should return a component for a directory that is content or a child of content', () => {
        existsStub.withArgs(TARAJI_CONTENT).returns(true);
        directoryStub.withArgs(TARAJI_CONTENT).returns(true);
        readDirStub.withArgs(TARAJI_DIR).returns(['a.taraji-meta.xml', 'a']);
        getAdapterStub
          .withArgs(
            mockRegistry.types.tarajihenson,
            mockRegistry.adapters.tarajihenson
          )
          .returns({
            getComponent: (path: SourcePath) => {
              if (path === TARAJI_XML) {
                return TARAJI_COMPONENT;
              }
            }
          });
        expect(registry.getComponentsFromPath(TARAJI_CONTENT)).to.deep.equal([
          TARAJI_COMPONENT
        ]);
      });

      it('Should not add duplicates of a component when the content has multiple -meta.xmls', () => {
        existsStub.withArgs(SIMON_BUNDLE).returns(true);
        directoryStub.withArgs(SIMON_BUNDLE).returns(true);
        const filenames = [
          SIMON_XML,
          SIMON_SUBTYPE,
          SIMON_SOURCE_1,
          SIMON_SOURCE_2,
          SIMON_SOURCE_3
        ].map(f => basename(f));
        readDirStub.withArgs(SIMON_BUNDLE).returns(filenames);
        getAdapterStub
          .withArgs(
            mockRegistry.types.simonpegg,
            mockRegistry.adapters.simonpegg
          )
          .returns({
            getComponent: () => SIMON_COMPONENT
          });
        expect(registry.getComponentsFromPath(SIMON_BUNDLE)).to.deep.equal([
          SIMON_COMPONENT
        ]);
      });
    });
  });
});
