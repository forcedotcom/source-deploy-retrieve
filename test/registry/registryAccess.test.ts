/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { assert, expect } from 'chai';
import { Messages, SfError } from '@salesforce/core';
import { MetadataRegistry, MetadataType, registry, RegistryAccess } from '../../src';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.load('@salesforce/source-deploy-retrieve', 'sdr', ['error_missing_type_definition']);

describe('RegistryAccess', () => {
  const registryAccess = new RegistryAccess();

  describe('getTypeByName', () => {
    it('should return alias of a type when one exists', () => {
      expect(registryAccess.getTypeByName('EmailTemplateFolder')).to.deep.equal(registry.types.emailfolder);
    });

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
        SfError,
        messages.getMessage('error_missing_type_definition', ['typewithoutdef'])
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
      const foundType = registryAccess.findType((type: MetadataType) => type.suffix === 'objectTranslation');
      expect(foundType).to.deep.equal(registry.types.customobjecttranslation);
    });
    it('should resolve aliases', () => {
      const foundType = registryAccess.findType((type: MetadataType) => type.suffix === 'emailTemplateFolder');
      expect(foundType).to.deep.equal(registry.types.emailfolder);
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

  describe('aliasTypes', () => {
    it('should return 1 aliases type', () => {
      const aliasTypes = registryAccess.getAliasTypes();
      expect(aliasTypes.length).to.equal(1);
      expect(aliasTypes[0].name).to.equal('EmailTemplateFolder');
    });
  });

  describe('getFolderContentTypes', () => {
    it('should return all the types with a folderContentType property defined', () => {
      const type = registry.types.reportfolder;
      const type2 = registry.types.dashboardfolder;
      const type3 = registry.types.documentfolder;
      const type4 = registry.types.emailfolder;
      expect(registryAccess.getFolderContentTypes()).to.deep.equal([type, type2, type3, type4]);
    });
    it('should not include EmailTemplateFolder', () => {
      expect(registryAccess.getFolderContentTypes()).to.not.deep.include(registry.types.emailtemplatefolder);
    });
  });
});
