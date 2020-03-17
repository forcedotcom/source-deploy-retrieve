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
import { RegistryAccess, registryData } from '../../src/metadata-registry';
import { META_XML_SUFFIX } from '../../src/metadata-registry/constants';
import { nls } from '../../src/i18n';
import { mockRegistry } from '../mock/registry';
import { join } from 'path';
import { TypeInferenceError } from '../../src/errors';
import * as util from '../../src/metadata-registry/util';

const env = createSandbox();

describe('Metadata Registry', () => {
  const registry = new RegistryAccess(mockRegistry);

  describe('Registry Data', () => {
    it('Should not allow adding new properties', () => {
      try {
        // Ignoring this because typescript does catch this problem since it's a frozen object,
        // but still want to verify this won't work.
        // @ts-ignore
        registryData.suffixes.sample = 'new';
        fail('Should not have been able to add a property');
      } catch (e) {}
    });

    it('Should not allow changing existing properties', () => {
      try {
        registryData.types.apexclass.inFolder = false;
        fail('Should not have been able to change a property');
      } catch (e) {}
    });

    it('Should not allow deleting properties', () => {
      try {
        delete registryData.types.apexclass;
        fail('Should not have been able to delete a property');
      } catch (e) {}
    });
  });

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

      // describe('Types with no mixed content', () => {
      //   const cmpPath = join('path', 'to', 'keanus', 'MyKeanu.keanu');
      //   const metaXml = `${cmpPath}${META_XML_SUFFIX}`;

      //   it(`Should return a component when given a ${META_XML_SUFFIX} file`, () => {
      //     existsStub.withArgs(cmpPath).returns(false);
      //     existsStub.withArgs(metaXml).returns(true);
      //     expect(registry.getComponentsFromPath(metaXml)[0]).to.deep.equal({
      //       fullName: 'MyKeanu',
      //       type: mockRegistry.types.keanureeves,
      //       metaXml,
      //       sources: []
      //     });
      //   });

      //   it(`Should return a component w/ source file when given a ${META_XML_SUFFIX} file`, () => {
      //     existsStub.withArgs(cmpPath).returns(true);
      //     existsStub.withArgs(metaXml).returns(true);
      //     expect(registry.getComponentsFromPath(metaXml)[0]).to.deep.equal({
      //       fullName: 'MyKeanu',
      //       type: mockRegistry.types.keanureeves,
      //       metaXml,
      //       sources: [cmpPath]
      //     });
      //   });

      //   it(`Should return a component w/ ${META_XML_SUFFIX} file when given a source path`, () => {
      //     existsStub.withArgs(cmpPath).returns(true);
      //     existsStub.withArgs(metaXml).returns(true);
      //     expect(registry.getComponentsFromPath(cmpPath)[0]).to.deep.equal({
      //       fullName: 'MyKeanu',
      //       type: mockRegistry.types.keanureeves,
      //       metaXml,
      //       sources: [cmpPath]
      //     });
      //   });

      //   it(`Should throw missing ${META_XML_SUFFIX} file error when given a source path and the xml is missing`, () => {
      //     existsStub.withArgs(cmpPath).returns(true);
      //     existsStub.withArgs(metaXml).returns(false);
      //     try {
      //       registry.getComponentsFromPath(cmpPath);
      //       fail(`Should have thrown a missing ${META_XML_SUFFIX} file error`);
      //     } catch (e) {
      //       expect(e.message).to.equal(
      //         nls.localize(
      //           'registry_error_missing_metadata_xml',
      //           'MyKeanu.keanu'
      //         )
      //       );
      //     }
      //   });

      //   it('Should format fullName for folder types correctly', () => {
      //     const path = join(
      //       'path',
      //       'to',
      //       'kathys',
      //       'A_Folder',
      //       'TestKathy.kathy-meta.xml'
      //     );
      //     existsStub.withArgs(path).returns(true);
      //     const cmp = registry.getComponentsFromPath(path)[0];
      //     expect(cmp.fullName).to.equal('A_Folder/TestKathy');
      //   });
      // });
    });
  });
});
