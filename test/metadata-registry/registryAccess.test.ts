/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { assert, expect } from 'chai';
import { RegistryError } from '../../src/errors';
import { nls } from '../../src/i18n';
import { RegistryAccess } from '../../src/metadata-registry/registryAccess';
import { mockRegistry } from '../mock/registry';

describe('RegistryAccess', () => {
  const access = new RegistryAccess(mockRegistry);

  it('should return apiVersion of the registry', () => {
    expect(access.apiVersion).to.equal(mockRegistry.apiVersion);
  });

  describe('getTypeByName', () => {
    it('should fetch type regardless of casing', () => {
      expect(access.getTypeByName('KeAnUReeVes')).to.deep.equal(mockRegistry.types.keanureeves);
    });

    it('should ignore leading and trailing spaces', () => {
      expect(access.getTypeByName('  kathyBates ')).to.deep.equal(mockRegistry.types.kathybates);
    });

    it('should throw an error if type definition missing', () => {
      assert.throws(
        () => access.getTypeByName('TypeWithoutDef'),
        RegistryError,
        nls.localize('error_missing_type_definition', mockRegistry.suffixes.missing)
      );
    });
  });

  describe('getTypeBySuffix', () => {
    it('should get known type by suffix', () => {
      const type = mockRegistry.types.keanureeves;
      expect(access.getTypeBySuffix(type.suffix)).to.deep.equal(type);
    });

    it('should return undefined for unknown suffix', () => {
      expect(access.getTypeBySuffix('asdf')).to.be.undefined;
    });
  });

  describe('findType', () => {
    it('should find a type using a given predicate', () => {
      const foundType = access.findType((type) => type.suffix === 'dtl');
      expect(foundType).to.deep.equal(mockRegistry.types.decomposedtoplevel);
    });
  });

  describe('getStrictFolderTypes', () => {
    it('should return all the types requiring a parent directory named after its type', () => {
      const types = Object.values(mockRegistry.strictTypeFolder).map(
        (typeId) => mockRegistry.types[typeId]
      );
      expect(access.getStrictFolderTypes()).to.deep.equal(types);
    });
  });
});
