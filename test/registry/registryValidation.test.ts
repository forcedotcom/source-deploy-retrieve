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
import { assert, expect } from 'chai';
import { MetadataType } from '../../src/registry/types';
import { metadataTypes as UnsupportedTypes } from '../../src/registry/nonSupportedTypes';
import { presets } from './presetTesting';

describe('will run preset tests', () => {
  for (const preset of presets) {
    describe(`Registry Validation ${preset.name}`, () => {
      const registry = preset.registry;
      const typesWithChildren = Object.values(registry.types).filter((type) => type.children);

      describe('non-supported types', () => {
        Object.values(registry.types).forEach((type) => {
          it(`${type.name} should not be in UnsupportedTypes`, () => {
            expect(UnsupportedTypes).to.not.include(type.name);
          });
        });
        typesWithChildren.forEach((type) => {
          Object.values(type.children?.types ?? []).forEach((child) => {
            it(`${child.name} should not be in UnsupportedTypes`, () => {
              expect(UnsupportedTypes).to.not.include(child.name);
            });
          });
        });
      });

      describe('child types', () => {
        describe('child types cannot also be top-level types', () => {
          typesWithChildren.forEach((type) => {
            Object.values(type.children?.types ?? []).forEach((child) => {
              it(`${child.name} should not be a top-level type`, () => {
                expect(registry.types[child.id]).to.not.exist;
              });
            });
          });
        });
        describe('child types are configured properly', () => {
          typesWithChildren.forEach((type) => {
            it(`${type.name} has a valid children configuration`, () => {
              expect(type.children).to.have.property('types');
              expect(type.children).to.have.property('suffixes');
              if (type.strategies?.decomposition === 'folderPerType') {
                // otherwise children will be written as files with topLevel
                expect(type.children).to.have.property('directories');
              }
              Object.values(type.children?.types ?? []).forEach((childType) => {
                assert(childType.suffix);
                if (type.strategies?.decomposition === 'folderPerType') {
                  assert(type.children?.directories);
                  expect(type.children.directories[childType.directoryName]).to.equal(childType.id);
                }
                expect(type.children?.suffixes[childType.suffix]).to.equal(childType.id);
              });
            });
          });
        });

        describe('every child type has an entry in children', () => {
          const childMapping = new Map<string, string>();

          typesWithChildren.map((parentType) =>
            Object.values(parentType.children?.types ?? []).map((childType) => {
              childMapping.set(childType.id, parentType.id);
            })
          );

          childMapping.forEach((parentId, childId) => {
            it(`has a childType for ${childId} : ${parentId}`, () => {
              expect(parentId).to.be.a('string');
              expect(childId).to.be.a('string');
              expect(registry.childTypes[childId]).to.equal(parentId);
            });
          });
        });

        describe('every childTypes top-level property maps to a top-level type that has it in its childTypes', () => {
          Object.entries(registry.childTypes)
            .filter(([, parentId]) => parentId)
            .forEach(([childId, parentId]) => {
              it(`childTypes member ${childId} matches a parent type ${parentId}`, () => {
                expect(registry.types[parentId]).to.have.property('children');
                expect(registry.types[parentId]?.children?.types).to.have.property(childId);
              });
            });
        });
      });

      describe('aliases', () => {
        describe('all aliases point to real types', () => {
          Object.values(registry.types)
            .filter((type) => type.aliasFor)
            .forEach((aliasType) => {
              it(`${aliasType.name} is aliased to  ${aliasType.aliasFor} and that exists`, () => {
                assert(aliasType.aliasFor);
                expect(registry.types[aliasType.aliasFor]).to.exist;
              });
            });
        });
      });

      describe('suffixes', () => {
        describe('all properties of suffixes match a real parent or child type', () => {
          Object.entries(registry.suffixes ?? []).forEach(([suffix, typeId]) => {
            it(`suffix ${suffix} matches a parent or child type ${typeId}`, () => {
              // could be a parent type or a child type
              // exclusion for legacy suffixes
              if (registry.childTypes[typeId]) {
                expect(registry.types[registry.childTypes[typeId]].children?.types[typeId].suffix).to.equal(suffix);
              } else if (registry.types[typeId].legacySuffix) {
                // if there are legacy suffixes, this could be either that or the regular suffix
                expect([registry.types[typeId].legacySuffix, registry.types[typeId].suffix]).to.include(suffix);
              } else {
                expect(registry.types[typeId].suffix).to.equal(suffix);
              }
            });
          });
        });
        describe('suffix object is complete', () => {
          const typesWhoChoseSettingsAsTheirSuffix = [
            'IndustriesManufacturingSettings',
            'IntegrationHubSettings',
            'ActionableEventOrchDef',
            'ActionableEventTypeDef',
            'ObjectHierarchyRelationship',
          ];

          const knownExceptions = [
            ...typesWhoChoseSettingsAsTheirSuffix,
            'DataSource', // both ExternalDataSource and DataSource use the suffix .dataSource :(
            'CustomLabel', // custom label (child of customLabel has suffix labels in types BUT has an entry in suffixes that points to customlabels )
            'CustomLabels', // custom label (child of customLabel has suffix labels in types BUT has an entry in suffixes that points to customlabels )
            'MatchingRules', // same suffix on MatchingRule and MatchingRules
            'MatchingRule', // same suffix on MatchingRule and MatchingRules
            'DigitalExperienceBundle', // no suffix for DigitalExperience child md type
          ];

          const suffixMap = new Map<string, string>();
          Object.values(registry.types)
            .filter(
              (type) =>
                type.suffix && !type.aliasFor && !type.strictDirectoryName && !knownExceptions.includes(type.name)
            )
            .map((type) => {
              assert(type.suffix);
              // mapping for the type's suffix
              suffixMap.set(type.suffix, type.id);
              if (type.children) {
                Object.values(type.children.types).map((childType) => {
                  assert(childType.suffix);
                  // mapping for the child's suffix
                  suffixMap.set(childType.suffix, childType.id);
                });
              }
            });
          suffixMap.forEach((typeid, suffix) => {
            it(`has a suffix entry for "${suffix}" : "${typeid}"`, () => {
              expect(typeid).to.be.a('string');
              expect(suffix).to.be.a('string');
              expect(registry.suffixes?.[suffix]).to.equal(typeid);
            });
          });
        });

        describe('suffixes must be unique on non-strict types', () => {
          const suffixMap = new Map<string, MetadataType[]>();
          Object.values(registry.types).map((type) => {
            if (type.suffix) {
              // some bundle types have no suffix
              const found = suffixMap.get(type.suffix);
              suffixMap.set(type.suffix, found ? [...found, type] : [type]);
            }
          });
          suffixMap.forEach((types, suffix) => {
            if (types.length > 1) {
              // identify when a single suffix is used in multiple metadata types.
              // when the happens, there can only be one who is not marked as strictDirectoryName
              it(`Suffix "${suffix}" used by types (${types
                .map((type) => type.name)
                .join(',')}) should have only 1 non-strict directory`, () => {
                const nonStrictTypes = types.filter((type) => !type.strictDirectoryName);
                expect(nonStrictTypes.length, nonStrictTypes.map((type) => type.name).join(',')).lessThan(2);
              });
            }
          });
        });
      });

      describe('strictDirectories', () => {
        describe('strict types are all in strictDirectoryNames', () => {
          const strictTypeMap = new Map<string, string>();
          Object.values(registry.types)
            .filter((type) => type.strictDirectoryName)
            .map((type) => {
              // the type's suffix
              strictTypeMap.set(type.directoryName, type.id);
            });
          strictTypeMap.forEach((typeid, strictDirectoryName) => {
            it(`has a strictDirectoryNames entry for "${strictDirectoryName}" : "${typeid}"`, () => {
              expect(typeid).to.be.a('string');
              expect(strictDirectoryName).to.be.a('string');
              expect(registry.strictDirectoryNames[strictDirectoryName]).to.equal(typeid);
            });
          });
        });

        describe('strictDirectoryNames all map to types with strictDirectoryName and correct directoryName', () => {
          Object.entries(registry.strictDirectoryNames ?? []).forEach(([dirName, typeId]) => {
            it(`directory member ${dirName} matches a parent type ${typeId}`, () => {
              expect(registry.types[typeId].directoryName).equal(dirName);
              expect(registry.types[typeId].strictDirectoryName).equal(true);
            });
          });

          const strictTypeMap = new Map<string, string>();
          Object.values(registry.types)
            .filter((type) => type.strictDirectoryName)
            .map((type) => {
              // the type's suffix
              strictTypeMap.set(type.directoryName, type.id);
            });
          strictTypeMap.forEach((typeid, strictDirectoryName) => {
            it(`has a strictDirectoryNames entry for "${strictDirectoryName}" : "${typeid}"`, () => {
              expect(typeid).to.be.a('string');
              expect(strictDirectoryName).to.be.a('string');
              expect(registry.strictDirectoryNames[strictDirectoryName]).to.equal(typeid);
            });
          });
        });
      });

      describe('ids match keys and are lowercase of xmlName', () => {
        Object.entries(registry.types).forEach(([key, type]) => {
          it(`id ${type.id} matches key ${key}`, () => {
            expect(type.id).to.equal(key);
          });
          it(`id ${type.id} is lowercased xmlName ${type.name}`, () => {
            expect(type.id).to.equal(type.name.toLowerCase());
          });
        });
        describe('check ids on child types', () => {
          Object.values(registry.types)
            .filter((type) => type.children)
            .forEach((type) => {
              Object.entries(type.children?.types ?? []).forEach(([key, childType]) => {
                it(`id ${childType.id} matches key ${key}`, () => {
                  expect(childType.id).to.equal(key);
                });
              });
            });
        });
      });

      describe('top level required properties', () => {
        describe('all have names and directoryName', () => {
          Object.values(registry.types).forEach((type) => {
            it(`${type.id} has a name`, () => {
              expect(type.name).to.be.a('string');
            });
            it(`${type.id} has a directoryName`, () => {
              expect(type.directoryName).to.be.a('string');
            });
          });
        });
      });

      describe('valid strategies', () => {
        const typesWithStrategies = Object.values(registry.types).filter((type) => type.strategies);

        // there isn't an enum for this in Types, to the known are hardcoded here
        describe('valid, known adapters', () => {
          typesWithStrategies.forEach((type) => {
            it(`${type.id} has a valid adapter`, () => {
              expect([
                'default',
                'mixedContent',
                'bundle',
                'matchingContentFile',
                'decomposed',
                'partiallyDecomposed',
                'digitalExperience',
              ]).includes(type.strategies?.adapter);
            });
          });
        });

        describe('adapter = matchingContentFile => no other strategy properties', () => {
          typesWithStrategies
            .filter((t) => t.strategies?.adapter === 'matchingContentFile')
            .forEach((type) => {
              it(`${type.id} has no other strategy properties`, () => {
                expect(type.strategies?.decomposition).to.be.undefined;
                expect(type.strategies?.recomposition).to.be.undefined;
                expect(type.strategies?.transformer).to.be.undefined;
              });
            });
        });

        describe('adapter = bundle => no other strategy properties', () => {
          typesWithStrategies
            .filter((t) => t.strategies?.adapter === 'bundle')
            .forEach((type) => {
              it(`${type.id} has no other strategy properties`, () => {
                expect(type.strategies?.decomposition).to.be.undefined;
                expect(type.strategies?.recomposition).to.be.undefined;
                expect(type.strategies?.transformer).to.be.undefined;
              });
            });
        });
        describe('nondecomposed have exactly 1 child', () => {
          typesWithStrategies
            .filter((t) => t.strategies?.transformer === 'nonDecomposed')
            .forEach((type) => {
              it(`${type.id} has one child`, () => {
                expect(type.children?.types).to.exist;
                expect(Object.keys(type.children?.types ?? []).length).to.equal(1);
              });
            });
        });

        describe('adapter = decomposed => has transformer and decomposition props', () => {
          typesWithStrategies
            .filter((t) => t.strategies?.adapter === 'decomposed')
            .forEach((type) => {
              it(`${type.id} has expected properties`, () => {
                assert(typeof type.strategies?.decomposition === 'string');
                expect(['folderPerType', 'topLevel'].includes(type.strategies.decomposition)).to.be.true;
                assert(typeof type.strategies?.transformer === 'string');

                expect(
                  [
                    'decomposed',
                    'nondecomposed',
                    'standard',
                    'staticResource',
                    'decomposedPermissionSet',
                    'decomposedLabels',
                  ].includes(type.strategies.transformer)
                ).to.be.true;
                expect(type.strategies.recomposition).to.be.undefined;
              });
            });
        });
        it('no standard types specified in registry', () => {
          expect(typesWithStrategies.filter((t) => t.strategies?.transformer === 'standard')).to.have.length(0);
        });
        describe('adapter = mixedContent => has no decomposition/recomposition props', () => {
          typesWithStrategies
            .filter((t) => t.strategies?.adapter === 'mixedContent')
            .forEach((type) => {
              it(`${type.id} has expected properties`, () => {
                expect(type.strategies?.decomposition).to.be.undefined;
                expect(type.strategies?.recomposition).to.be.undefined;
                type.strategies?.transformer
                  ? expect(type.strategies?.transformer).to.be.a('string')
                  : expect(type.strategies?.transformer).to.be.undefined;
              });
            });
        });
      });

      describe('folders', () => {
        const folderTypes = Object.values(registry.types).filter((type) => type.inFolder);

        folderTypes.forEach((type) => {
          it(`${type.name} has a valid folderType in the registry`, () => {
            expect(type.folderType).to.not.be.undefined;
            assert(type.folderType);
            expect(registry.types[type.folderType]).to.be.an('object');
          });
        });
      });

      describe('thou shalt not use .xml as a suffix without strictDir', () => {
        // this causes lots of cases of mistaken identity
        const xmlIsMySuffix = Object.values(registry.types).filter((type) => type.suffix === '.xml');

        xmlIsMySuffix.forEach((type) => {
          it(`${type.name} has strictDir: true`, () => {
            expect(type.strictDirectoryName).to.equal(true);
          });
        });
      });
    });
  }
});
