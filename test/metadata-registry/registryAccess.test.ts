/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { assert, expect } from 'chai';
import { RegistryError } from '../../src/errors';
import { nls } from '../../src/i18n';
import { MetadataRegistry } from '../../src/metadata-registry';
import { mockRegistry, mockRegistryData } from '../mock/registry';

describe('RegistryAccess', () => {
  it('should return apiVersion of the registry', () => {
    expect(mockRegistry.apiVersion).to.equal(mockRegistryData.apiVersion);
  });

  describe('getTypeByName', () => {
    it('should fetch type regardless of casing', () => {
      expect(mockRegistry.getTypeByName('KeAnUReeVes')).to.deep.equal(
        mockRegistryData.types.keanureeves
      );
    });

    it('should ignore leading and trailing spaces', () => {
      expect(mockRegistry.getTypeByName('  xmlinFolder ')).to.deep.equal(
        mockRegistryData.types.xmlinfolder
      );
    });

    it('should fetch child type definition', () => {
      expect(mockRegistry.getTypeByName('x')).to.deep.equal(
        mockRegistryData.types.reginaking.children.types.x
      );
    });

    it('should throw an error if type definition missing', () => {
      assert.throws(
        () => mockRegistry.getTypeByName('TypeWithoutDef'),
        RegistryError,
        nls.localize('error_missing_type_definition', 'typewithoutdef')
      );
    });

    it('should throw an error if child type definition missing', () => {
      assert.throws(
        () => mockRegistry.getTypeByName('badchildtype'),
        RegistryError,
        nls.localize('error_missing_child_type_definition', [
          'mixedcontentsinglefile',
          'badchildtype',
        ])
      );
    });
  });

  describe('getTypeBySuffix', () => {
    it('should get known type by suffix', () => {
      const type = mockRegistryData.types.keanureeves;
      expect(mockRegistry.getTypeBySuffix(type.suffix)).to.deep.equal(type);
    });

    it('should return undefined for unknown suffix', () => {
      expect(mockRegistry.getTypeBySuffix('asdf')).to.be.undefined;
    });
  });

  describe('findType', () => {
    it('should find a type using a given predicate', () => {
      const foundType = mockRegistry.findType((type) => type.suffix === 'dtl');
      expect(foundType).to.deep.equal(mockRegistryData.types.decomposedtoplevel);
    });
  });

  describe('getStrictFolderTypes', () => {
    it('should return all the types requiring a parent directory named after its type', () => {
      const types = Object.values(mockRegistryData.strictDirectoryNames).map(
        (typeId) => (mockRegistryData as MetadataRegistry).types[typeId]
      );
      expect(mockRegistry.getStrictFolderTypes()).to.deep.equal(types);
    });
  });
});
