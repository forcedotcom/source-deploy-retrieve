/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { assert, expect } from 'chai';
import * as fs from 'fs';
import { createSandbox, SinonStub } from 'sinon';
import { RegistryAccess } from '../../src/metadata-registry';
import { nls } from '../../src/i18n';
import {
  mockRegistry,
  KEANU_SOURCE,
  DWAYNE_DIR,
  KEANU_XML,
  KEANU_COMPONENT,
  TARAJI_SOURCE_2,
  TARAJI_COMPONENT
} from '../mock/registry';
import { join } from 'path';
import { TypeInferenceError } from '../../src/errors';
import * as util from '../../src/metadata-registry/util';
import * as adapters from '../../src/metadata-registry/adapters';

const env = createSandbox();

describe('RegistryAccess', () => {
  const registry = new RegistryAccess(mockRegistry);

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

    it('Should throw file not found error if given path does not exist', () => {
      existsStub.withArgs(KEANU_SOURCE).returns(false);

      assert.throws(
        () => registry.getComponentsFromPath(KEANU_SOURCE),
        TypeInferenceError,
        nls.localize('error_path_not_found', [KEANU_SOURCE])
      );
    });

    it('Should throw directories not supported error for paths to directories', () => {
      existsStub.withArgs(DWAYNE_DIR).returns(true);
      directoryStub.returns(true);

      assert.throws(
        () => registry.getComponentsFromPath(DWAYNE_DIR),
        TypeInferenceError,
        nls.localize('error_directories_not_supported')
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
});
