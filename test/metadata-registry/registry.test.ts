/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { fail } from 'assert';
import { expect, assert } from 'chai';
import * as fs from 'fs';
import { createSandbox, SinonStub } from 'sinon';
import { RegistryAccess } from '../../src/metadata-registry';
import { META_XML_SUFFIX } from '../../src/metadata-registry/constants';
import { nls } from '../../src/i18n';
import { mockRegistry } from '../mock/registry';
import { join } from 'path';
import { TypeInferenceError } from '../../src/errors';
import * as util from '../../src/metadata-registry/util';

const env = createSandbox();

describe('Metadata Registry', () => {
  const registry = new RegistryAccess(mockRegistry);

  describe('RegistryAccess', () => {
    describe('getTypeFromName', () => {
      it('Should fetch type regardless of casing', () => {
        // throws an error if it doesn't exist
        registry.getTypeFromName('KeAnUReeVes');
      });

      it('Should fetch type regardless of spaces', () => {
        registry.getTypeFromName('kathy Bates');
      });

      it('Should throw an error if definition missing', () => {
        assert.throws(
          () => registry.getTypeFromName('TypeWithNoDefinition'),
          TypeInferenceError
        );
      });
    });

    describe('getComponentsFromPath', () => {
      let existsStub: SinonStub;
      let directoryStub: SinonStub;

      beforeEach(() => {
        existsStub = env.stub(fs, 'existsSync');
        directoryStub = env.stub(util, 'isDirectory').returns(false);
      });
      afterEach(() => env.restore());

      it('Should throw file not found error if given path does not exist', () => {
        const cmpPath = join('path', 'to', 'keanus', 'MyKeanu.keanu');
        existsStub.withArgs(cmpPath).returns(false);
        assert.throws(
          () => registry.getComponentsFromPath(cmpPath),
          TypeInferenceError
        );
      });

      it('Should throw directories not supported error for paths to directories', () => {
        const sourcePath = join('path', 'to', 'dwayne');
        existsStub.withArgs(sourcePath).returns(true);
        directoryStub.returns(true);
        assert.throws(
          () => registry.getComponentsFromPath(sourcePath),
          TypeInferenceError,
          nls.localize('error_directories_not_supported')
        );
      });

      it('Should throw missing type definition error for types without an entry (rare)', () => {
        const metaXml = join(
          'path',
          'to',
          'missing',
          'TypeDef.missing-meta.xml'
        );
        existsStub.withArgs(metaXml).returns(true);
        assert.throws(
          () => registry.getComponentsFromPath(metaXml),
          TypeInferenceError,
          nls.localize(
            'error_missing_type_definition',
            mockRegistry.suffixes.missing
          )
        );
      });
    });
  });
});
