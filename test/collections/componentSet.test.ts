/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { fail } from 'assert';
import { join } from 'path';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { expect } from 'chai';
import { createSandbox, SinonStub } from 'sinon';
import { AuthInfo, Connection, Messages } from '@salesforce/core';
import {
  ComponentSet,
  ConnectionResolver,
  DestructiveChangesType,
  ManifestResolver,
  MetadataApiDeploy,
  MetadataApiRetrieve,
  MetadataComponent,
  MetadataMember,
  MetadataResolver,
  registry,
  RegistryAccess,
  SourceComponent,
} from '../../src';
import { mockConnection } from '../mock/client';
import { decomposedtoplevel, matchingContentFile, mixedContentSingleFile } from '../mock';
import { MATCHING_RULES_COMPONENT } from '../mock/type-constants/customlabelsConstant';
import * as manifestFiles from '../mock/manifestConstants';
import { testApiVersionAsString } from '../mock/manifestConstants';
import * as coverage from '../../src/registry/coverage';
import { testApiVersion } from '../mock/manifestConstants';

const env = createSandbox();
const $$ = testSetup(env);
const registryAccess = new RegistryAccess();

describe('ComponentSet', () => {
  afterEach(() => env.restore());

  describe('Initializers', () => {
    describe('fromSource', () => {
      const resolved = [matchingContentFile.COMPONENT];

      let getComponentsStub: SinonStub;

      beforeEach(() => {
        getComponentsStub = env.stub(MetadataResolver.prototype, 'getComponentsFromPath').returns(resolved);
      });

      it('should initialize with result from source resolver', () => {
        const result = ComponentSet.fromSource('.').toArray();
        const expected = new MetadataResolver(registryAccess, manifestFiles.TREE).getComponentsFromPath('.');

        expect(result).to.deep.equal(expected);
      });

      it('should initialize with source backed components using a single file path', () => {
        const result = ComponentSet.fromSource('.').toArray();

        expect(getComponentsStub.callCount).to.equal(1);
        expect(getComponentsStub.firstCall.args[0]).to.equal('.');
        expect(result).to.deep.equal(resolved);
      });

      it('should initialize with source backed components using multiple file paths', () => {
        const paths = ['folder1', 'folder2'];

        const result = ComponentSet.fromSource(paths).toArray();

        expect(getComponentsStub.callCount).to.equal(2);
        expect(getComponentsStub.firstCall.args[0]).to.equal(paths[0]);
        expect(getComponentsStub.secondCall.args[0]).to.equal(paths[1]);
        expect(result).to.deep.equal(resolved);
      });

      it('should initialize with source backed components using options object', () => {
        getComponentsStub.restore();

        const result = ComponentSet.fromSource({
          fsPaths: ['staticresources'],
          registry: registryAccess,
          tree: manifestFiles.TREE,
        }).toArray();
        const expected = new MetadataResolver(registryAccess, manifestFiles.TREE).getComponentsFromPath(
          'staticresources'
        );

        expect(result).to.deep.equal(expected);
      });

      it('should initialize with components marked for delete using options object', () => {
        getComponentsStub.restore();

        const compSet = ComponentSet.fromSource({
          fsPaths: ['staticresources'],
          registry: registryAccess,
          tree: manifestFiles.TREE,
          fsDeletePaths: ['objectTranslations'],
        });
        const result = compSet.toArray();
        const mdResolver = new MetadataResolver(registryAccess, manifestFiles.TREE);
        const expected = mdResolver.getComponentsFromPath('staticresources');
        mdResolver.getComponentsFromPath('objectTranslations').forEach((comp) => {
          comp.setMarkedForDelete();
          expected.push(comp);
        });

        expect(result).to.deep.equal(expected);
        expect(!!compSet.getTypesOfDestructiveChanges().length).to.be.true;
      });
    });

    describe('fromManifest', () => {
      it('should initialize with components using a path', async () => {
        const expected: MetadataComponent[] = [
          {
            fullName: 'Test',
            type: registry.types.apexclass,
          },
        ];
        const resolveStub = env.stub(ManifestResolver.prototype, 'resolve').resolves({
          components: expected,
          apiVersion: testApiVersionAsString,
        });
        env.stub(RegistryAccess.prototype, 'getTypeByName').returns(registry.types.apexclass);
        const manifest = manifestFiles.ONE_FOLDER_MEMBER;
        const set = await ComponentSet.fromManifest(manifest.name);

        const result = set.toArray();

        expect(resolveStub.callCount).to.equal(1);
        expect(result).to.deep.equal(expected);
      });

      it('should initialize with components using an options object', async () => {
        const manifest = manifestFiles.ONE_OF_EACH;
        const set = await ComponentSet.fromManifest({
          manifestPath: manifest.name,
          registry: registryAccess,
          tree: manifestFiles.TREE,
        });

        const result = set.toArray();
        const expected = await new ManifestResolver(manifestFiles.TREE, registryAccess).resolve(manifest.name);

        expect(result).to.deep.equal(expected.components);
      });

      it('should initialize with source backed components when specifying resolvePaths option', async () => {
        const set = await ComponentSet.fromManifest({
          manifestPath: manifestFiles.ONE_OF_EACH.name,
          registry: registryAccess,
          tree: manifestFiles.TREE,
          resolveSourcePaths: ['objectTranslations', 'staticresources'],
        });

        const result = set.toArray();
        const expected = new MetadataResolver(registryAccess, manifestFiles.TREE).getComponentsFromPath('.');
        const missingIndex = expected.findIndex((c) => c.fullName === 'c');
        expected.splice(missingIndex, 1);

        expect(result).to.deep.equal(expected);
      });

      it('should resolve wildcard members by default', async () => {
        const set = await ComponentSet.fromManifest({
          manifestPath: manifestFiles.ONE_WILDCARD.name,
          registry: registryAccess,
          tree: manifestFiles.TREE,
        });

        const result = set.has({ fullName: '*', type: 'StaticResource' });

        expect(result).to.be.true;
      });

      it('should resolve wildcard members when forceAddWildcards = true', async () => {
        const set = await ComponentSet.fromManifest({
          manifestPath: manifestFiles.ONE_WILDCARD.name,
          registry: registryAccess,
          tree: manifestFiles.TREE,
          forceAddWildcards: true,
        });

        const result = set.has({ fullName: '*', type: 'StaticResource' });

        expect(result).to.be.true;
      });

      it('should resolve components and not wildcard members when forceAddWildcards = false', async () => {
        const set = await ComponentSet.fromManifest({
          manifestPath: manifestFiles.ONE_WILDCARD.name,
          registry: registryAccess,
          tree: manifestFiles.TREE,
          resolveSourcePaths: ['.'],
          forceAddWildcards: false,
        });

        const result = set.toArray();
        const expected = new MetadataResolver(registryAccess, manifestFiles.TREE).getComponentsFromPath(
          'staticresources'
        );

        expect(result).to.deep.equal(expected);
      });

      it('should resolve source and wildcard components when forceAddWildcards = true and resolvePaths are specified', async () => {
        const set = await ComponentSet.fromManifest({
          manifestPath: manifestFiles.ONE_WILDCARD.name,
          registry: registryAccess,
          tree: manifestFiles.TREE,
          resolveSourcePaths: ['.'],
          forceAddWildcards: true,
        });
        const sourceComponents = new MetadataResolver(registryAccess, manifestFiles.TREE).getComponentsFromPath(
          'staticresources'
        );

        const result = set.toArray();
        const expected = [{ fullName: '*', type: registry.types.staticresource }, ...sourceComponents];

        expect(result).to.deep.equal(expected);
      });

      it('should add components even if they were not resolved', async () => {
        const set = await ComponentSet.fromManifest({
          manifestPath: manifestFiles.ONE_FOLDER_MEMBER.name,
          registry: registryAccess,
          tree: manifestFiles.TREE,
          resolveSourcePaths: ['.'],
        });

        const result = set.toArray();
        const expected = [
          {
            fullName: 'Test_Folder',
            type: registry.types.documentfolder,
          },
        ];

        expect(result).to.deep.equal(expected);
      });
    });

    describe('fromConnection', () => {
      it('should initialize using a connection', async () => {
        const connection = await mockConnection($$);
        const expected: MetadataComponent[] = [
          {
            fullName: 'Test',
            type: registry.types.apexclass,
          },
        ];
        const resolveStub = env.stub(ConnectionResolver.prototype, 'resolve').resolves({
          components: expected,
          apiVersion: testApiVersionAsString,
        });
        env.stub(RegistryAccess.prototype, 'getTypeByName').returns(registry.types.apexclass);
        const set = await ComponentSet.fromConnection({ usernameOrConnection: connection });

        const result = set.toArray();

        expect(resolveStub.callCount).to.equal(1);
        expect(result).to.deep.equal(expected);
      });

      it('should initialize using an username with apiVersion', async () => {
        const expected: MetadataComponent[] = [
          {
            fullName: 'Test',
            type: registry.types.apexclass,
          },
        ];
        const resolveStub = env.stub(ConnectionResolver.prototype, 'resolve').resolves({
          components: expected,
          apiVersion: '50.0',
        });
        env.stub(RegistryAccess.prototype, 'getTypeByName').returns(registry.types.apexclass);
        const username = 'test@foobar.com';
        const testData = new MockTestOrgData($$.uniqid(), { username });

        $$.stubAuths(testData);
        const set = await ComponentSet.fromConnection({
          usernameOrConnection: username,
          apiVersion: '50.0',
        });

        const result = set.toArray();
        expect(set.apiVersion).to.be.equal('50.0');
        expect(resolveStub.callCount).to.equal(1);
        expect(result).to.deep.equal(expected);
      });

      it('should initialize using an username', async () => {
        const username = 'test@foobar.com';
        const testData = new MockTestOrgData($$.uniqid(), { username });
        $$.stubAuths(testData);
        const connection = await Connection.create({
          authInfo: await AuthInfo.create({
            username: 'test@foobar.com',
          }),
        });
        const expected: MetadataComponent[] = [
          {
            fullName: 'Test',
            type: registry.types.apexclass,
          },
        ];

        const resolveStub = env.stub(ConnectionResolver.prototype, 'resolve').resolves({
          components: expected,
          apiVersion: connection.getApiVersion(),
        });
        env.stub(RegistryAccess.prototype, 'getTypeByName').returns(registry.types.apexclass);
        const set = await ComponentSet.fromConnection('test@foobar.com');

        const result = set.toArray();
        expect(set.apiVersion).to.be.equal(connection.getApiVersion());
        expect(resolveStub.callCount).to.equal(1);
        expect(result).to.deep.equal(expected);
      });
    });

    describe('constructor', () => {
      it('should initialize non-source backed components from members', () => {
        const set = new ComponentSet(
          [
            {
              fullName: 'Test1',
              type: registry.types.customobjecttranslation.name,
            },
            {
              fullName: 'Test2',
              type: registry.types.staticresource.name,
            },
          ],
          registryAccess
        );

        expect(Array.from(set)).to.deep.equal([
          {
            fullName: 'Test1',
            type: registry.types.customobjecttranslation,
          },
          {
            fullName: 'Test2',
            type: registry.types.staticresource,
          },
        ]);
      });
    });
  });

  describe('getObject', () => {
    beforeEach(() => {
      env.stub(coverage, 'getCurrentApiVersion').resolves(testApiVersion);
    });

    it('should return an object representing the package manifest', async () => {
      const set = ComponentSet.fromSource({
        fsPaths: ['.'],
        registry: registryAccess,
        tree: manifestFiles.TREE,
      });
      expect(await set.getObject()).to.deep.equal({
        Package: {
          types: [
            {
              name: registry.types.customobjecttranslation.name,
              members: ['a'],
            },
            {
              name: registry.types.staticresource.name,
              members: ['b', 'c'],
            },
          ],
          version: testApiVersionAsString,
        },
      });
    });

    it('should allow the componentSet to set the apiVersion', async () => {
      const set = ComponentSet.fromSource({
        fsPaths: ['.'],
        registry: registryAccess,
        tree: manifestFiles.TREE,
      });
      set.apiVersion = testApiVersionAsString;
      expect(await set.getObject()).to.deep.equal({
        Package: {
          types: [
            {
              name: registry.types.customobjecttranslation.name,
              members: ['a'],
            },
            {
              name: registry.types.staticresource.name,
              members: ['b', 'c'],
            },
          ],
          version: testApiVersionAsString,
        },
      });
    });

    it('should return an object representing destructive changes manifest', async () => {
      const set = ComponentSet.fromSource({
        fsPaths: [],
        registry: registryAccess,
        tree: manifestFiles.TREE,
        fsDeletePaths: ['.'],
      });
      expect(await set.getObject(DestructiveChangesType.POST)).to.deep.equal({
        Package: {
          types: [
            {
              name: registry.types.customobjecttranslation.name,
              members: ['a'],
            },
            {
              name: registry.types.staticresource.name,
              members: ['b', 'c'],
            },
          ],
          version: testApiVersionAsString,
        },
      });
    });

    it('should return an object representing the package manifest with fullName', async () => {
      const set = ComponentSet.fromSource({
        fsPaths: ['.'],
        registry: registryAccess,
        tree: manifestFiles.TREE,
      });
      set.fullName = 'testFullName';
      expect(await set.getObject()).to.deep.equal({
        Package: {
          fullName: 'testFullName',
          types: [
            {
              name: registry.types.customobjecttranslation.name,
              members: ['a'],
            },
            {
              name: registry.types.staticresource.name,
              members: ['b', 'c'],
            },
          ],
          version: testApiVersionAsString,
        },
      });
    });

    it('should return an object representing the package manifest with sourceApiVersion', async () => {
      const set = ComponentSet.fromSource({
        fsPaths: ['.'],
        registry: registryAccess,
        tree: manifestFiles.TREE,
      });
      set.sourceApiVersion = '45.0';
      expect(await set.getObject()).to.deep.equal({
        Package: {
          types: [
            {
              name: registry.types.customobjecttranslation.name,
              members: ['a'],
            },
            {
              name: registry.types.staticresource.name,
              members: ['b', 'c'],
            },
          ],
          version: set.sourceApiVersion,
        },
      });
    });

    it('should interpret folder components as members of the type they are a container for', async () => {
      const member = { fullName: 'Test_Folder', type: 'Document' };
      const set = new ComponentSet([member], registryAccess);

      expect(set.has(member)).to.be.true;
      expect((await set.getObject()).Package.types).to.deep.equal([
        {
          name: registry.types.document.name,
          members: ['Test_Folder'],
        },
      ]);
    });

    it('should include required child types as defined in the registry', async () => {
      const set = new ComponentSet([MATCHING_RULES_COMPONENT]);
      expect((await set.getObject()).Package.types).to.deep.equal([
        { name: 'MatchingRule', members: ['MatchingRules.My_Account_Matching_Rule'] },
        { name: MATCHING_RULES_COMPONENT.type.name, members: [MATCHING_RULES_COMPONENT.name] },
      ]);
    });

    it('should exclude components that are not addressable as defined in the registry', async () => {
      const type = registry.types.customobjecttranslation.children.types.customfieldtranslation;
      const set = new ComponentSet();
      set.add(new SourceComponent({ name: type.name, type }));
      expect((await set.getObject()).Package.types).to.deep.equal([]);
    });

    it('should write wildcards and names of types with supportsWildcardAndName=true, regardless of order', async () => {
      const type = registry.types.customobject;
      const set = new ComponentSet();
      set.add(new SourceComponent({ name: 'myType', type }));
      set.add(new SourceComponent({ name: '*', type }));
      set.add(new SourceComponent({ name: 'myType2', type }));
      set.add(new SourceComponent({ name: 'myType', type }));
      expect((await set.getObject()).Package.types).to.deep.equal([
        { members: ['*', 'myType', 'myType2'], name: 'CustomObject' },
      ]);
    });

    it('should overwrite a singular name with wildcard when supportsWildcardAndName=false', async () => {
      const type = registry.types.apexclass;
      const set = new ComponentSet();
      set.add(new SourceComponent({ name: 'myType', type }));
      set.add(new SourceComponent({ name: '*', type }));
      set.add(new SourceComponent({ name: 'myType2', type }));
      set.add(new SourceComponent({ name: 'myType', type }));
      expect((await set.getObject()).Package.types).to.deep.equal([{ members: ['*'], name: 'ApexClass' }]);
    });

    it('should exclude child components that are not addressable as defined in the registry', async () => {
      const childType = registry.types.customobjecttranslation.children.types.customfieldtranslation;
      const type = registry.types.customobjecttranslation;
      const set = new ComponentSet();
      const testComp = new SourceComponent({ name: type.name, type });
      const childComp = new SourceComponent({ name: childType.name, type: childType });
      $$.SANDBOX.stub(testComp, 'getChildren').returns([childComp]);
      set.add(testComp);
      expect((await set.getObject()).Package.types).to.deep.equal([
        {
          name: 'CustomObjectTranslation',
          members: ['CustomObjectTranslation'],
        },
      ]);
    });

    /**
     * If component set keys are incorrectly handled, child component names may not be returned properly.
     */
    it('should correctly return addressable child components', async () => {
      const set = new ComponentSet([{ fullName: 'MyParent__c.Child__c', type: 'customfield' }], registryAccess);

      expect((await set.getObject()).Package.types).to.deep.equal([
        {
          name: 'CustomField',
          members: ['MyParent__c.Child__c'],
        },
      ]);
    });
  });

  describe('getPackageXml', () => {
    beforeEach(() => {
      env.stub(coverage, 'getCurrentApiVersion').resolves(testApiVersion);
    });
    it('should return manifest string when initialized from manifest file', async () => {
      const manifest = manifestFiles.ONE_OF_EACH;
      const set = await ComponentSet.fromManifest({
        manifestPath: manifest.name,
        registry: registryAccess,
        tree: manifestFiles.TREE,
      });

      const result = await set.getPackageXml();
      const expected = manifest.data.toString();

      expect(result).to.equal(expected);
    });

    it('should return manifest string when initialized from source', async () => {
      const set = ComponentSet.fromSource({
        fsPaths: ['.'],
        registry: registryAccess,
        tree: manifestFiles.TREE,
      });
      expect((await set.getPackageXml(4)).toString()).to.equal(manifestFiles.BASIC.data.toString());
    });

    it('should return destructive changes manifest string when initialized from source', async () => {
      const set = ComponentSet.fromSource({
        fsPaths: [],
        registry: registryAccess,
        tree: manifestFiles.TREE,
        fsDeletePaths: ['.'],
      });
      expect(await set.getPackageXml(4, DestructiveChangesType.POST)).to.equal(manifestFiles.BASIC.data.toString());
    });
  });

  describe('getSourceComponents', () => {
    it('should return source-backed components in the set', () => {
      const set = ComponentSet.fromSource({
        fsPaths: ['staticresources'],
        registry: registryAccess,
        tree: manifestFiles.TREE,
      });
      set.add({ fullName: 'Test', type: 'CustomObjectTranslation' });
      const expected = new MetadataResolver(registryAccess, manifestFiles.TREE).getComponentsFromPath(
        'staticresources'
      );

      expect(set.getSourceComponents().toArray()).to.deep.equal(expected);
    });

    it('should return source-backed components that match the given metadata member', () => {
      const set = ComponentSet.fromSource({
        fsPaths: ['.'],
        registry: registryAccess,
        tree: manifestFiles.TREE,
      });
      const expected = new MetadataResolver(registryAccess, manifestFiles.TREE).getComponentsFromPath(
        join('staticresources', 'b.resource-meta.xml')
      );

      expect(set.size).to.equal(3);
      expect(Array.from(set.getSourceComponents({ fullName: 'b', type: 'staticresource' }))).to.deep.equal(expected);
    });
  });

  describe('deploy', () => {
    it('should properly construct a deploy operation', async () => {
      const connection = await mockConnection($$);
      const set = ComponentSet.fromSource({
        fsPaths: ['.'],
        registry: registryAccess,
        tree: manifestFiles.TREE,
      });
      const operationArgs = { components: set, usernameOrConnection: connection };
      const expectedOperation = new MetadataApiDeploy(operationArgs);
      const startStub = env.stub(expectedOperation, 'start').resolves();
      const constructorStub = env
        .stub()
        .withArgs(operationArgs)
        .callsFake(() => expectedOperation);
      Object.setPrototypeOf(MetadataApiDeploy, constructorStub);

      const result = await set.deploy({ usernameOrConnection: connection });

      expect(result).to.deep.equal(expectedOperation);
      expect(startStub.calledOnce).to.be.true;
    });

    it('should properly construct a deploy operation with overridden apiVersion', async () => {
      const connection = await mockConnection($$);
      const apiVersion = '50.0';
      const set = ComponentSet.fromSource({
        fsPaths: ['.'],
        registry: registryAccess,
        tree: manifestFiles.TREE,
      });
      set.apiVersion = apiVersion;
      const operationArgs = { components: set, usernameOrConnection: connection, apiVersion };
      const expectedOperation = new MetadataApiDeploy(operationArgs);
      const startStub = env.stub(expectedOperation, 'start').resolves();
      const constructorStub = env
        .stub()
        .withArgs(operationArgs)
        .callsFake(() => expectedOperation);
      Object.setPrototypeOf(MetadataApiDeploy, constructorStub);

      const result = await set.deploy({ usernameOrConnection: connection });

      expect(result).to.deep.equal(expectedOperation);
      expect(startStub.calledOnce).to.be.true;
    });

    it('should throw error if there are no source backed components when deploying', async () => {
      const set = await ComponentSet.fromManifest({
        manifestPath: manifestFiles.ONE_OF_EACH.name,
        registry: registryAccess,
        tree: manifestFiles.TREE,
      });
      try {
        await set.deploy({ usernameOrConnection: 'test@foobar.com' });
        fail('should have thrown an error');
      } catch (e) {
        Messages.importMessagesDirectory(__dirname);
        const messages = Messages.load('@salesforce/source-deploy-retrieve', 'sdr', ['error_no_source_to_deploy']);

        expect(e.name).to.equal('ComponentSetError');
        expect(e.message).to.equal(messages.getMessage('error_no_source_to_deploy'));
      }
    });
  });

  describe('retrieve', () => {
    it('should properly construct a retrieve operation', async () => {
      const connection = await mockConnection($$);
      const set = ComponentSet.fromSource({
        fsPaths: ['.'],
        registry: registryAccess,
        tree: manifestFiles.TREE,
      });
      const operationArgs = {
        components: set,
        output: join('test', 'path'),
        usernameOrConnection: connection,
      };
      const expectedOperation = new MetadataApiRetrieve(operationArgs);
      const startStub = env.stub(expectedOperation, 'start').resolves();
      const constructorStub = env
        .stub()
        .withArgs(operationArgs)
        .callsFake(() => expectedOperation);
      Object.setPrototypeOf(MetadataApiRetrieve, constructorStub);

      const result = await set.retrieve({
        output: operationArgs.output,
        usernameOrConnection: connection,
      });

      expect(result).to.deep.equal(expectedOperation);
      expect(startStub.calledOnce).to.be.true;
    });

    it('should properly construct a retrieve operation with overridden apiVersion', async () => {
      const connection = await mockConnection($$);
      const apiVersion = '50.0';
      const set = ComponentSet.fromSource({
        fsPaths: ['.'],
        registry: registryAccess,
        tree: manifestFiles.TREE,
      });
      set.apiVersion = apiVersion;
      const operationArgs = {
        apiVersion,
        components: set,
        output: join('test', 'path'),
        usernameOrConnection: connection,
      };
      const expectedOperation = new MetadataApiRetrieve(operationArgs);
      const startStub = env.stub(expectedOperation, 'start').resolves();
      const constructorStub = env
        .stub()
        .withArgs(operationArgs)
        .callsFake(() => expectedOperation);
      Object.setPrototypeOf(MetadataApiRetrieve, constructorStub);

      const result = await set.retrieve({
        output: operationArgs.output,
        usernameOrConnection: connection,
      });

      expect(result).to.deep.equal(expectedOperation);
      expect(startStub.calledOnce).to.be.true;
    });

    it('should properly construct a retrieve operation with packageName', async () => {
      const connection = await mockConnection($$);
      const set = new ComponentSet([]);
      const operationArgs = {
        components: set,
        output: join('test', 'path'),
        usernameOrConnection: connection,
        packages: ['MyPackage'],
      };
      const expectedOperation = new MetadataApiRetrieve(operationArgs);
      const startStub = env.stub(expectedOperation, 'start').resolves();
      const constructorStub = env
        .stub()
        .withArgs(operationArgs)
        .callsFake(() => expectedOperation);
      Object.setPrototypeOf(MetadataApiRetrieve, constructorStub);

      const result = await set.retrieve({
        packageOptions: ['MyPackage'],
        output: operationArgs.output,
        usernameOrConnection: connection,
      });

      expect(result).to.deep.equal(expectedOperation);
      expect(startStub.calledOnce).to.be.true;
    });
  });

  describe('add', () => {
    it('should add metadata member to package components', async () => {
      const set = new ComponentSet(undefined, registryAccess);

      expect(set.size).to.equal(0);

      set.add({ fullName: 'foo', type: 'CustomObjectTranslation' });

      expect(Array.from(set)).to.deep.equal([
        {
          fullName: 'foo',
          type: registry.types.customobjecttranslation,
        },
      ]);
    });

    it('should add metadata component to package components', async () => {
      const set = new ComponentSet(undefined, registryAccess);
      const component = { fullName: 'bar', type: registry.types.staticresource };

      expect(set.size).to.equal(0);

      set.add(component);

      expect(Array.from(set)).to.deep.equal([component]);
    });

    it('should add metadata component marked for delete to package components', async () => {
      const set = new ComponentSet(undefined, registryAccess);
      expect(!!set.getTypesOfDestructiveChanges().length).to.be.false;

      const component = new SourceComponent({
        name: mixedContentSingleFile.COMPONENT.name,
        type: mixedContentSingleFile.COMPONENT.type,
        xml: mixedContentSingleFile.COMPONENT.xml,
      });
      set.add(component, DestructiveChangesType.POST);

      expect(!!set.getTypesOfDestructiveChanges().length).to.be.true;
      expect(set.getSourceComponents().first().isMarkedForDelete()).to.be.true;
      expect(set.has(component)).to.be.true;
    });

    it('should delete metadata from package components, if its present in destructive changes', async () => {
      const set = new ComponentSet(undefined, registryAccess);
      expect(!!set.getTypesOfDestructiveChanges().length).to.be.false;

      const component = new SourceComponent({
        name: mixedContentSingleFile.COMPONENT.name,
        type: mixedContentSingleFile.COMPONENT.type,
        xml: mixedContentSingleFile.COMPONENT.xml,
      });
      set.add(component, DestructiveChangesType.POST);

      expect(!!set.getTypesOfDestructiveChanges().length).to.be.true;
      expect(set.getDestructiveChangesType()).to.equal(DestructiveChangesType.POST);
      expect(set.getSourceComponents().first().isMarkedForDelete()).to.be.true;

      set.add(component);
      set.setDestructiveChangesType(DestructiveChangesType.PRE);
      expect(set.getDestructiveChangesType()).to.equal(DestructiveChangesType.PRE);
      expect(set.getSourceComponents().first().isMarkedForDelete()).to.be.true;
      expect(set.has(component)).to.be.true;
      expect(set.getSourceComponents().toArray().length).to.equal(1);
    });
  });

  describe('has', () => {
    it('should correctly evaluate membership with MetadataMember', () => {
      const set = new ComponentSet(undefined, registryAccess);
      const member: MetadataMember = {
        fullName: 'a',
        type: 'StaticResource',
      };

      expect(set.has(member)).to.be.false;

      set.add({
        fullName: 'a',
        type: registry.types.staticresource,
      });

      expect(set.has(member)).to.be.true;
    });

    it('should correctly evaluate membership with MetadataComponent', () => {
      const set = new ComponentSet(undefined, registryAccess);
      const component: MetadataComponent = {
        fullName: 'a',
        type: registry.types.staticresource,
      };

      expect(set.has(component)).to.be.false;

      set.add({
        fullName: 'a',
        type: 'StaticResource',
      });

      expect(set.has(component)).to.be.true;
    });

    it('should correctly evaluate membership of component with wildcard of component type in set', () => {
      const component = mixedContentSingleFile.COMPONENT;
      const set = new ComponentSet(undefined, registryAccess);

      expect(set.has(component)).to.be.false;

      set.add({ fullName: ComponentSet.WILDCARD, type: component.type });

      expect(set.has(component)).to.be.true;
    });

    it('should correctly evaluate membership of component with parent in set', () => {
      const parent = decomposedtoplevel.DECOMPOSED_TOP_LEVEL_COMPONENT;
      const [child] = parent.getChildren();
      const set = new ComponentSet(undefined, registryAccess);

      expect(set.has(child)).to.be.false;

      set.add(parent);

      expect(set.has(child)).to.be.true;
    });

    it('should correctly evaluate membership of component with wildcard of parent type in set', () => {
      const parent = decomposedtoplevel.DECOMPOSED_TOP_LEVEL_COMPONENT;
      const [child] = parent.getChildren();
      const set = new ComponentSet(undefined, registryAccess);

      expect(set.has(child)).to.be.false;

      set.add({ fullName: ComponentSet.WILDCARD, type: parent.type });

      expect(set.has(child)).to.be.true;
    });
  });

  it('should calculate size correctly', () => {
    const set = ComponentSet.fromSource({
      fsPaths: ['.'],
      registry: registryAccess,
      tree: manifestFiles.TREE,
    });

    expect(set.size).to.equal(3);
  });
});
