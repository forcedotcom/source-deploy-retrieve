/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { assert, expect, use } from 'chai';
import { Messages, SfError } from '@salesforce/core';
import deepEqualInAnyOrder from 'deep-equal-in-any-order';
import { MetadataType, registry, RegistryAccess } from '../../src';

use(deepEqualInAnyOrder);

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

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
        registry.types.customobject.children?.types.customfield
      );
    });

    it('should throw an error if type definition missing', () => {
      assert.throws(
        () => registryAccess.getTypeByName('TypeWithoutDef'),
        SfError,
        messages.getMessage('error_missing_type_definition', ['TypeWithoutDef'])
      );
    });

    describe('suggestions for type name', () => {
      it('should suggest Workflow for Worflow (sic)', () => {
        try {
          registryAccess.getTypeByName('Worflow');
        } catch (e) {
          assert(e instanceof SfError);
          expect(e.actions).to.have.length.greaterThan(0);
          expect(e.actions?.join()).to.include('Workflow');
        }
      });
      it('should provide several suggestions for unresolvable types that are nowhere', () => {
        try {
          registryAccess.getTypeByName('&&&&&&');
        } catch (e) {
          assert(e instanceof SfError);
          expect(e.actions).to.have.length.greaterThan(1);
        }
      });
    });
  });

  describe('getTypeBySuffix', () => {
    it('should get known type by suffix', () => {
      const type = registry.types.apexclass;
      assert(type.suffix, 'Type should have a suffix defined for this test to work.');
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
      const types = Object.values(registry.strictDirectoryNames).map((typeId) => registry.types[typeId]);
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
      expect(registryAccess.getFolderContentTypes()).to.deep.equalInAnyOrder([type, type2, type3, type4]);
    });
    it('should not include EmailTemplateFolder', () => {
      expect(registryAccess.getFolderContentTypes()).to.not.deep.include(registry.types.emailtemplatefolder);
    });
  });

  describe('getParentType', () => {
    it('should return a valid parent for a child metadata type', () => {
      assert(registry.types.digitalexperiencebundle.children?.types.digitalexperience.id);
      assert(registry.types.customobject.children?.types.customfield.id);
      expect(
        registryAccess.getParentType(registry.types.digitalexperiencebundle.children.types.digitalexperience.id)
      ).to.be.equal(registry.types.digitalexperiencebundle);
      expect(registryAccess.getParentType(registry.types.customobject.children.types.customfield.id)).to.be.equal(
        registry.types.customobject
      );
    });

    it('should return undefined parent for a top level metadata type', () => {
      expect(registryAccess.getParentType(registry.types.experiencebundle.id)).to.be.undefined;
      expect(registryAccess.getParentType(registry.types.digitalexperienceconfig.id)).to.be.undefined;
    });
  });

  describe('suggestions', () => {
    it('guess for a type that is all uppercase should return the correct type first', () => {
      const result = registryAccess.guessTypeBySuffix('CLS');
      expect(result?.[0].metadataTypeGuess.name).to.equal('ApexClass');
    });
    it('guess for a type that is first-uppercase should return the correct type first', () => {
      const result = registryAccess.guessTypeBySuffix('Cls');
      expect(result?.[0].metadataTypeGuess.name).to.equal('ApexClass');
    });
  });
});
