/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { assert, expect } from 'chai';
import { RegistryError } from '../../src/errors';
import { nls } from '../../src/i18n';
import { MetadataRegistry, MetadataType, registry, RegistryAccess } from '../../src';

describe('RegistryAccess', () => {
  const registryAccess = new RegistryAccess();
  it('should return apiVersion of the registry', () => {
    expect(registryAccess.apiVersion).to.equal(registry.apiVersion);
  });

  describe('getTypeByName', () => {
    it('should fetch type regardless of casing', () => {
      expect(registryAccess.getTypeByName('apexclass')).to.deep.equal(registry.types.apexclass);
    });

    it('should ignore leading and trailing spaces', () => {
      expect(registryAccess.getTypeByName('  document ')).to.deep.equal(registry.types.document);
    });

    it('should fetch child type definition', () => {
      expect(registryAccess.getTypeByName('customfield')).to.deep.equal(
        registry.types.customobject.children.types.customfield
      );
    });

    it('should throw an error if type definition missing', () => {
      assert.throws(
        () => registryAccess.getTypeByName('TypeWithoutDef'),
        RegistryError,
        nls.localize('error_missing_type_definition', 'typewithoutdef')
      );
    });

    it('should throw an error if child type definition missing', () => {
      assert.throws(
        () => registryAccess.getTypeByName('badchildtype'),
        RegistryError,
        nls.localize('error_missing_child_type_definition', ['mixedcontentsinglefile', 'badchildtype'])
      );
    });
  });

  describe('getTypeBySuffix', () => {
    it('should get known type by suffix', () => {
      const type = registry.types.apexclass;
      expect(registryAccess.getTypeBySuffix(type.suffix)).to.deep.equal(type);
    });

    it('should return undefined for unknown suffix', () => {
      expect(registryAccess.getTypeBySuffix('asdf')).to.be.undefined;
    });
  });

  describe('findType', () => {
    it('should find a type using a given predicate', () => {
      const foundType = registryAccess.findType((type: MetadataType) => type.suffix === 'dtl');
      expect(foundType).to.deep.equal(registry.types.customobjecttranslation);
    });
  });

  describe('getStrictFolderTypes', () => {
    it('should return all the types requiring a parent directory named after its type', () => {
      const types = Object.values(registry.strictDirectoryNames).map(
        (typeId) => (registry as MetadataRegistry).types[typeId]
      );
      expect(registryAccess.getStrictFolderTypes()).to.deep.equal(types);
    });
  });

  describe('getFolderContentTypes', () => {
    it('should return all the types with a folderContentType property defined', () => {
      const type = registry.types.reportfolder;
      const type2 = registry.types.dashboardfolder;
      expect(registryAccess.getFolderContentTypes()).to.deep.equal([type, type2]);
    });
  });
});
