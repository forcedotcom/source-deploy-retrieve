/*
 * Copyright 2025, Salesforce, Inc.
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
import { fail } from 'node:assert';
import { join } from 'node:path';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { assert, expect } from 'chai';
import { SinonStub } from 'sinon';
import { AuthInfo, ConfigAggregator, Connection, Lifecycle, Messages, SfProject } from '@salesforce/core';
import {
  DECOMPOSED_CHILD_COMPONENT_1_EMPTY,
  DECOMPOSED_CHILD_COMPONENT_2_EMPTY,
  DECOMPOSED_COMPONENT_EMPTY,
} from '../mock/type-constants/customObjectConstantEmptyObjectMeta';
import {
  ComponentSet,
  ComponentSetBuilder,
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
  ZipTreeContainer,
} from '../../src';
import { decomposedtoplevel, digitalExperienceBundle, matchingContentFile, mixedContentSingleFile } from '../mock';
import { MATCHING_RULES_COMPONENT } from '../mock/type-constants/customlabelsConstant';
import * as manifestFiles from '../mock/manifestConstants';
import { testApiVersion, testApiVersionAsString } from '../mock/manifestConstants';
import * as coverage from '../../src/registry/coverage';

const registryAccess = new RegistryAccess();

describe('ComponentSet', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();

  describe('apiVersion and sourceApiVersion', () => {
    const maxVersion = '55.0';
    const configVersion = '54.0';
    const componentSetVersion = '53.0';
    const sourceApiVersion = '52.0';
    const manifestVersion = '51.0';
    const sourcepath = join(process.cwd(), 'test', 'nuts', 'local', 'replacements', 'testProj');

    let connection: Connection;
    let lifecycleEmitStub: sinon.SinonStub;
    let connectionRetrieveStub: sinon.SinonStub;
    let connectionDeployStub: sinon.SinonStub;
    let retrieveMaxApiVersionStub: sinon.SinonStub;
    let componentSet: ComponentSet;

    beforeEach(() => {
      lifecycleEmitStub = $$.SANDBOX.stub(Lifecycle.prototype, 'emit');
    });

    const stubConnection = async () => {
      retrieveMaxApiVersionStub = $$.SANDBOX.stub(Connection.prototype, 'retrieveMaxApiVersion');
      retrieveMaxApiVersionStub.resolves(maxVersion);
      connection = await testOrg.getConnection();
      connectionRetrieveStub = $$.SANDBOX.stub(connection.metadata, 'retrieve');
      connectionRetrieveStub.resolves({ id: '00DCompsetTest' });
      connectionDeployStub = $$.SANDBOX.stub(connection.metadata, 'deploy');
      connectionDeployStub.resolves({ id: '00DCompsetTest' });
    };

    const stubConfig = () => {
      $$.SANDBOX.stub(ConfigAggregator.prototype, 'getInfo')
        .withArgs('org-api-version')
        .returns({
          key: 'org-api-version',
          location: ConfigAggregator.Location.LOCAL,
          value: configVersion,
          path: '',
          isLocal: () => true,
          isGlobal: () => false,
          isEnvVar: () => false,
        });
    };

    const getManifestContent = (version: string) => ({
      types: [
        { members: ['replaceStuff'], name: 'ApexClass' },
        { members: ['TestObj__c.FieldA__c'], name: 'CustomField' },
        { members: ['TestObj__c'], name: 'CustomObject' },
        { members: ['ImageTest', 'Test'], name: 'StaticResource' },
      ],
      version,
    });

    describe('retrieve', () => {
      it('should default to max version supported by the target org', async () => {
        componentSet = await ComponentSetBuilder.build({ sourcepath: [sourcepath] });
        await stubConnection();
        await componentSet.retrieve({ output: '', usernameOrConnection: connection });

        const expectedPayload = { apiVersion: maxVersion, manifestVersion: maxVersion };
        expect(lifecycleEmitStub.args.flat()).to.deep.include('apiVersionRetrieve');
        expect(lifecycleEmitStub.args.flat()).to.deep.include(expectedPayload);
        expect(connectionRetrieveStub.called).to.be.true;
        expect(connectionRetrieveStub.args[0][0]).to.deep.equal({
          apiVersion: maxVersion,
          unpackaged: getManifestContent(maxVersion),
        });
      });

      it('should use the version in the sfdx config', async () => {
        componentSet = await ComponentSetBuilder.build({ sourcepath: [sourcepath] });
        stubConfig();
        await stubConnection();
        await componentSet.retrieve({ output: '', usernameOrConnection: connection });

        const expectedPayload = { apiVersion: configVersion, manifestVersion: configVersion };
        expect(lifecycleEmitStub.args.flat()).to.deep.include('apiVersionRetrieve');
        expect(lifecycleEmitStub.args.flat()).to.deep.include(expectedPayload);
        expect(connectionRetrieveStub.called).to.be.true;
        expect(connectionRetrieveStub.args[0][0]).to.deep.equal({
          apiVersion: configVersion,
          unpackaged: getManifestContent(configVersion),
        });
      });

      it('should use the version from a ComponentSet (usernameOrConnection = Connection)', async () => {
        // This usecase is when you call ComponentSet.retrieve() passing in a
        // connection object rather than an org username. The request is made using the apiVersion
        // from the ComponentSet.
        componentSet = await ComponentSetBuilder.build({ sourcepath: [sourcepath], apiversion: componentSetVersion });
        stubConfig();
        await stubConnection();
        await componentSet.retrieve({ output: '', usernameOrConnection: connection });

        const expectedPayload = { apiVersion: componentSetVersion, manifestVersion: componentSetVersion };
        expect(lifecycleEmitStub.args.flat()).to.deep.include('apiVersionRetrieve');
        expect(lifecycleEmitStub.args.flat()).to.deep.include(expectedPayload);
        expect(connectionRetrieveStub.called).to.be.true;
        expect(connectionRetrieveStub.args[0][0]).to.deep.equal({
          apiVersion: componentSetVersion,
          unpackaged: getManifestContent(componentSetVersion),
        });
      });

      it('should use the version from a ComponentSet (usernameOrConnection = string)', async () => {
        // This usecase is when you call ComponentSet.retrieve() passing in an org
        // username rather than a connection. The request is made using the apiVersion
        // from the ComponentSet.
        componentSet = await ComponentSetBuilder.build({ sourcepath: [sourcepath], apiversion: componentSetVersion });
        stubConfig();
        await stubConnection();
        // Have to stub `Connection.create()` because passing an org username will result
        // in calling MetadataTransfer.getConnection(), and we want to return our stub.
        $$.SANDBOX.stub(Connection, 'create').resolves(connection);
        await componentSet.retrieve({ output: '', usernameOrConnection: 'testorg' });

        const expectedPayload = { apiVersion: componentSetVersion, manifestVersion: componentSetVersion };
        expect(lifecycleEmitStub.args.flat()).to.deep.include('apiVersionRetrieve');
        expect(lifecycleEmitStub.args.flat()).to.deep.include(expectedPayload);
        expect(connectionRetrieveStub.called).to.be.true;
        expect(connectionRetrieveStub.args[0][0]).to.deep.equal({
          apiVersion: componentSetVersion,
          unpackaged: getManifestContent(componentSetVersion),
        });
      });

      it('should use the sourceApiVersion from a ComponentSet', async () => {
        componentSet = await ComponentSetBuilder.build({
          sourcepath: [sourcepath],
          apiversion: componentSetVersion,
          sourceapiversion: sourceApiVersion,
        });
        stubConfig();
        await stubConnection();
        await componentSet.retrieve({ output: '', usernameOrConnection: connection });

        const expectedPayload = { apiVersion: componentSetVersion, manifestVersion: sourceApiVersion };
        expect(lifecycleEmitStub.args.flat()).to.deep.include('apiVersionRetrieve');
        expect(lifecycleEmitStub.args.flat()).to.deep.include(expectedPayload);
        expect(connectionRetrieveStub.called).to.be.true;
        expect(connectionRetrieveStub.args[0][0]).to.deep.equal({
          apiVersion: sourceApiVersion,
          unpackaged: getManifestContent(sourceApiVersion),
        });
      });

      it('should use the version from the manifest', async () => {
        $$.SANDBOX.stub(ManifestResolver.prototype, 'resolve').resolves({
          components: [{ fullName: 'Test', type: registry.types.apexclass }],
          apiVersion: manifestVersion,
        });
        componentSet = await ComponentSetBuilder.build({
          manifest: { directoryPaths: [sourcepath], manifestPath: '.' },
          apiversion: componentSetVersion,
          sourceapiversion: sourceApiVersion,
        });
        stubConfig();
        await stubConnection();
        await componentSet.retrieve({ output: '', usernameOrConnection: connection });

        const expectedPayload = { apiVersion: componentSetVersion, manifestVersion };
        expect(lifecycleEmitStub.args.flat()).to.deep.include('apiVersionRetrieve');
        expect(lifecycleEmitStub.args.flat()).to.deep.include(expectedPayload);
        expect(connectionRetrieveStub.called).to.be.true;
        expect(connectionRetrieveStub.args[0][0]).to.deep.equal({
          apiVersion: manifestVersion,
          unpackaged: { types: [{ members: ['Test'], name: 'ApexClass' }], version: manifestVersion },
        });
      });

      it('should not emit pre- or post-retrieve events with the suppressEvents setting set to true', async () => {
        componentSet = await ComponentSetBuilder.build({ sourcepath: [sourcepath] });
        await stubConnection();
        await componentSet.retrieve({ output: '', usernameOrConnection: connection, suppressEvents: true });

        let preAndPostRetrieveEventCount = 0;
        lifecycleEmitStub.args.forEach((event) => {
          if (event[0] === 'scopedPreRetrieve' || event[0] === 'scopedPostRetrieve') {
            preAndPostRetrieveEventCount = preAndPostRetrieveEventCount + 1;
          }
        });
        expect(preAndPostRetrieveEventCount).to.equal(0);
      });
    });

    describe('deploy', () => {
      const verifyManifestVersionInZip = async (zipBuffer: Buffer, expectedVersion: string) => {
        const tree = await ZipTreeContainer.create(zipBuffer);
        const packageXmlBuffer = await tree.readFile('package.xml');
        expect(packageXmlBuffer.toString()).includes(`<version>${expectedVersion}</version>`);
      };

      it('should default to max version supported by the target org', async () => {
        componentSet = await ComponentSetBuilder.build({ sourcepath: [sourcepath] });
        await stubConnection();
        await componentSet.deploy({ usernameOrConnection: connection });

        const expectedPayload = { apiVersion: maxVersion, manifestVersion: maxVersion, webService: 'SOAP' };
        expect(lifecycleEmitStub.args[1][0]).to.equal('apiVersionDeploy');
        expect(lifecycleEmitStub.args.flat()).to.deep.include(expectedPayload);
        expect(connectionDeployStub.called).to.be.true;
        await verifyManifestVersionInZip(connectionDeployStub.args[0][0] as Buffer, maxVersion);
        expect(connection.getApiVersion()).to.equal(maxVersion);
      });

      it('should use the version in the sfdx config', async () => {
        componentSet = await ComponentSetBuilder.build({ sourcepath: [sourcepath] });
        stubConfig();
        await stubConnection();
        await componentSet.deploy({ usernameOrConnection: connection });

        const expectedPayload = { apiVersion: configVersion, manifestVersion: configVersion, webService: 'SOAP' };
        expect(lifecycleEmitStub.args[1][0]).to.equal('apiVersionDeploy');
        expect(lifecycleEmitStub.args.flat()).to.deep.include(expectedPayload);
        expect(connectionDeployStub.called).to.be.true;
        await verifyManifestVersionInZip(connectionDeployStub.args[0][0] as Buffer, configVersion);
        expect(connection.getApiVersion()).to.equal(configVersion);
      });

      it('should use the version from a ComponentSet (usernameOrConnection = connection)', async () => {
        // This usecase is when you call ComponentSet.retrieve() passing in a
        // connection object rather than an org username. The request is made using the apiVersion
        // from the ComponentSet.
        componentSet = await ComponentSetBuilder.build({ sourcepath: [sourcepath], apiversion: componentSetVersion });
        stubConfig();
        await stubConnection();
        await componentSet.deploy({ usernameOrConnection: connection });

        const expectedPayload = {
          apiVersion: componentSetVersion,
          manifestVersion: componentSetVersion,
          webService: 'SOAP',
        };
        expect(lifecycleEmitStub.args[1][0]).to.equal('apiVersionDeploy');
        expect(lifecycleEmitStub.args.flat()).to.deep.include(expectedPayload);
        expect(connectionDeployStub.called).to.be.true;
        await verifyManifestVersionInZip(connectionDeployStub.args[0][0] as Buffer, componentSetVersion);
        expect(connection.getApiVersion()).to.equal(componentSetVersion);
      });

      it('should use the version from a ComponentSet (usernameOrConnection = string)', async () => {
        // This usecase is when you call ComponentSet.retrieve() passing in an org
        // username rather than a connection. The request is made using the apiVersion
        // from the ComponentSet.
        componentSet = await ComponentSetBuilder.build({ sourcepath: [sourcepath], apiversion: componentSetVersion });
        stubConfig();
        await stubConnection();
        // Have to stub `Connection.create()` because passing an org username will result
        // in calling MetadataTransfer.getConnection(), and we want to return our stub.
        $$.SANDBOX.stub(Connection, 'create').resolves(connection);
        await componentSet.deploy({ usernameOrConnection: 'testorg' });

        const expectedPayload = {
          apiVersion: componentSetVersion,
          manifestVersion: componentSetVersion,
          webService: 'SOAP',
        };
        expect(lifecycleEmitStub.args[1][0]).to.equal('apiVersionDeploy');
        expect(lifecycleEmitStub.args.flat()).to.deep.include(expectedPayload);
        expect(connectionDeployStub.called).to.be.true;
        await verifyManifestVersionInZip(connectionDeployStub.args[0][0] as Buffer, componentSetVersion);
        expect(connection.getApiVersion()).to.equal(componentSetVersion);
      });

      it('should use the sourceApiVersion from a ComponentSet', async () => {
        componentSet = await ComponentSetBuilder.build({
          sourcepath: [sourcepath],
          apiversion: componentSetVersion,
          sourceapiversion: sourceApiVersion,
        });
        stubConfig();
        await stubConnection();
        await componentSet.deploy({ usernameOrConnection: connection });

        const expectedPayload = {
          apiVersion: componentSetVersion,
          manifestVersion: sourceApiVersion,
          webService: 'SOAP',
        };
        expect(lifecycleEmitStub.args[1][0]).to.equal('apiVersionDeploy');
        expect(lifecycleEmitStub.args.flat()).to.deep.include(expectedPayload);
        expect(connectionDeployStub.called).to.be.true;
        await verifyManifestVersionInZip(connectionDeployStub.args[0][0] as Buffer, sourceApiVersion);
        expect(connection.getApiVersion()).to.equal(componentSetVersion);
      });

      it('should use the version from the manifest', async () => {
        $$.SANDBOX.stub(ManifestResolver.prototype, 'resolve').resolves({
          components: [{ fullName: 'replaceStuff', type: registry.types.apexclass }],
          apiVersion: manifestVersion,
        });
        componentSet = await ComponentSetBuilder.build({
          manifest: { directoryPaths: [sourcepath], manifestPath: '.' },
          apiversion: componentSetVersion,
          sourceapiversion: sourceApiVersion,
        });
        stubConfig();
        await stubConnection();
        await componentSet.deploy({ usernameOrConnection: connection });

        const expectedPayload = { apiVersion: componentSetVersion, manifestVersion, webService: 'SOAP' };
        expect(lifecycleEmitStub.args[1][0]).to.equal('apiVersionDeploy');
        expect(lifecycleEmitStub.args.flat()).to.deep.include(expectedPayload);
        expect(connectionDeployStub.called).to.be.true;
        await verifyManifestVersionInZip(connectionDeployStub.args[0][0] as Buffer, manifestVersion);
        expect(connection.getApiVersion()).to.equal(componentSetVersion);
      });
    });
  });

  describe('Initializers', () => {
    describe('fromSource', () => {
      const resolved = [matchingContentFile.COMPONENT];

      let getComponentsStub: SinonStub;

      beforeEach(() => {
        getComponentsStub = $$.SANDBOX.stub(MetadataResolver.prototype, 'getComponentsFromPath').returns(resolved);
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
        const resolveStub = $$.SANDBOX.stub(ManifestResolver.prototype, 'resolve').resolves({
          components: expected,
          apiVersion: testApiVersionAsString,
        });
        $$.SANDBOX.stub(RegistryAccess.prototype, 'getTypeByName').returns(registry.types.apexclass);
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

      it('should resolve partial wildcard members by default', async () => {
        const set = await ComponentSet.fromManifest({
          manifestPath: manifestFiles.ONE_PARTIAL_WILDCARD.name,
          registry: registryAccess,
          tree: manifestFiles.TREE,
        });

        const result = set.has({ fullName: 'site/foo.*', type: 'DigitalExperience' });

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
        const connection = await testOrg.getConnection();
        const expected: MetadataComponent[] = [
          {
            fullName: 'Test',
            type: registry.types.apexclass,
          },
        ];
        const resolveStub = $$.SANDBOX.stub(ConnectionResolver.prototype, 'resolve').resolves({
          components: expected,
          apiVersion: testApiVersionAsString,
        });
        $$.SANDBOX.stub(RegistryAccess.prototype, 'getTypeByName').returns(registry.types.apexclass);
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
        const resolveStub = $$.SANDBOX.stub(ConnectionResolver.prototype, 'resolve').resolves({
          components: expected,
          apiVersion: '50.0',
        });
        $$.SANDBOX.stub(RegistryAccess.prototype, 'getTypeByName').returns(registry.types.apexclass);
        const username = 'test@foobar.com';
        const testData = new MockTestOrgData($$.uniqid(), { username });

        await $$.stubAuths(testData);
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
        await $$.stubAuths(testData);
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

        const resolveStub = $$.SANDBOX.stub(ConnectionResolver.prototype, 'resolve').resolves({
          components: expected,
          apiVersion: connection.getApiVersion(),
        });
        $$.SANDBOX.stub(RegistryAccess.prototype, 'getTypeByName').returns(registry.types.apexclass);
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
    const sfOrgApiVersion = process.env.SF_ORG_API_VERSION;
    let getCurrentApiVersionStub: SinonStub;

    beforeEach(() => {
      getCurrentApiVersionStub = $$.SANDBOX.stub(coverage, 'getCurrentApiVersion').resolves(testApiVersion);
    });

    afterEach(() => {
      process.env.SF_ORG_API_VERSION = sfOrgApiVersion;
      if (!sfOrgApiVersion) {
        delete process.env.SF_ORG_API_VERSION;
      }
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
      expect(getCurrentApiVersionStub.calledOnce).to.be.true;
    });

    it('should allow the componentSet to set the apiVersion', async () => {
      const resolveSpy = $$.SANDBOX.spy(SfProject.prototype, 'resolveProjectConfig');
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
      expect(resolveSpy.called).to.be.false;
      expect(getCurrentApiVersionStub.called).to.be.false;
    });

    it('should get an API version from sfdx-project.json', async () => {
      const sourceApiVersion = '58.0';
      const set = ComponentSet.fromSource({
        fsPaths: ['.'],
        registry: registryAccess,
        tree: manifestFiles.TREE,
      });
      const resolveStub = $$.SANDBOX.stub(SfProject.prototype, 'resolveProjectConfig').resolves({ sourceApiVersion });
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
          version: sourceApiVersion,
        },
      });
      expect(resolveStub.calledOnce).to.be.true;
      expect(getCurrentApiVersionStub.called).to.be.false;
    });

    it('should get an API version from env var', async () => {
      const set = ComponentSet.fromSource({
        fsPaths: ['.'],
        registry: registryAccess,
        tree: manifestFiles.TREE,
      });
      process.env.SF_ORG_API_VERSION = testApiVersionAsString;
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
      expect(getCurrentApiVersionStub.called).to.be.false;
    });

    it('should default to hardcoded API version 58.0 as a last resort', async () => {
      getCurrentApiVersionStub.reset();
      const causeErr = new Error('HTTP 404 - mdcoverage url is down');
      getCurrentApiVersionStub.throws(causeErr);
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
          version: '58.0',
        },
      });
      expect(getCurrentApiVersionStub.called).to.be.true;
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
      expect(getCurrentApiVersionStub.called).to.be.false;
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
      const type = registry.types.customobjecttranslation.children?.types.customfieldtranslation;
      assert(type);
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
      const type = registry.types.role;
      const set = new ComponentSet();
      set.add(new SourceComponent({ name: 'myType', type }));
      set.add(new SourceComponent({ name: '*', type }));
      set.add(new SourceComponent({ name: 'myType2', type }));
      set.add(new SourceComponent({ name: 'myType', type }));
      expect((await set.getObject()).Package.types).to.deep.equal([{ members: ['*'], name: 'Role' }]);
    });

    it('should exclude child components that are not addressable as defined in the registry', async () => {
      const childType = registry.types.customobjecttranslation.children?.types.customfieldtranslation;
      assert(childType);
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

    it('omits empty parents from the package manifest when not a retrieve', async () => {
      const set = new ComponentSet([
        DECOMPOSED_CHILD_COMPONENT_1_EMPTY,
        DECOMPOSED_CHILD_COMPONENT_2_EMPTY,
        DECOMPOSED_COMPONENT_EMPTY,
      ]);
      const types = (await set.getObject()).Package.types;
      expect(types.map((type) => type.name)).to.not.include(DECOMPOSED_COMPONENT_EMPTY.type.name);
      expect((await set.getObject()).Package.types).to.deep.equal([
        {
          name: DECOMPOSED_CHILD_COMPONENT_1_EMPTY.type.name,
          members: [DECOMPOSED_CHILD_COMPONENT_1_EMPTY.fullName],
        },
        {
          name: DECOMPOSED_CHILD_COMPONENT_2_EMPTY.type.name,
          members: [DECOMPOSED_CHILD_COMPONENT_2_EMPTY.fullName],
        },
      ]);
    });

    it('does not omit empty parents from the package manifest for retrieves', async () => {
      const set = new ComponentSet([
        DECOMPOSED_CHILD_COMPONENT_1_EMPTY,
        DECOMPOSED_CHILD_COMPONENT_2_EMPTY,
        DECOMPOSED_COMPONENT_EMPTY,
      ]);
      // @ts-expect-error modifying private property
      set.forRetrieve = true;
      expect((await set.getObject()).Package.types).to.deep.equal([
        {
          name: DECOMPOSED_CHILD_COMPONENT_1_EMPTY.type.name,
          members: [DECOMPOSED_CHILD_COMPONENT_1_EMPTY.fullName],
        },
        {
          name: DECOMPOSED_COMPONENT_EMPTY.type.name,
          members: [DECOMPOSED_COMPONENT_EMPTY.fullName],
        },
        {
          name: DECOMPOSED_CHILD_COMPONENT_2_EMPTY.type.name,
          members: [DECOMPOSED_CHILD_COMPONENT_2_EMPTY.fullName],
        },
      ]);
    });
  });

  describe('getPackageXml', () => {
    beforeEach(() => {
      $$.SANDBOX.stub(coverage, 'getCurrentApiVersion').resolves(testApiVersion);
    });
    it('should return manifest string when initialized from manifest file', async () => {
      const manifest = manifestFiles.ONE_OF_EACH;
      assert(manifest.data);
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
      expect((await set.getPackageXml(4)).toString()).to.equal(manifestFiles.BASIC.data?.toString());
    });

    it('should return destructive changes manifest string when initialized from source', async () => {
      const set = ComponentSet.fromSource({
        fsPaths: [],
        registry: registryAccess,
        tree: manifestFiles.TREE,
        fsDeletePaths: ['.'],
      });
      expect(await set.getPackageXml(4, DestructiveChangesType.POST)).to.equal(manifestFiles.BASIC.data?.toString());
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
      const connection = await testOrg.getConnection();
      const set = ComponentSet.fromSource({
        fsPaths: ['.'],
        registry: registryAccess,
        tree: manifestFiles.TREE,
      });
      const operationArgs = { components: set, usernameOrConnection: connection };
      const expectedOperation = new MetadataApiDeploy(operationArgs);
      const startStub = $$.SANDBOX.stub(expectedOperation, 'start').resolves();
      const constructorStub = $$.SANDBOX.stub()
        .withArgs(operationArgs)
        .callsFake(() => expectedOperation);
      Object.setPrototypeOf(MetadataApiDeploy, constructorStub);

      const result = await set.deploy({ usernameOrConnection: connection });

      expect(result).to.deep.equal(expectedOperation);
      expect(startStub.calledOnce).to.be.true;
    });

    it('should properly construct a deploy operation with overridden apiVersion', async () => {
      const connection = await testOrg.getConnection();
      const apiVersion = '50.0';
      const set = ComponentSet.fromSource({
        fsPaths: ['.'],
        registry: registryAccess,
        tree: manifestFiles.TREE,
      });
      set.apiVersion = apiVersion;
      const operationArgs = { components: set, usernameOrConnection: connection, apiVersion };
      const expectedOperation = new MetadataApiDeploy(operationArgs);
      const startStub = $$.SANDBOX.stub(expectedOperation, 'start').resolves();
      const constructorStub = $$.SANDBOX.stub()
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
        assert(e instanceof Error);
        Messages.importMessagesDirectory(__dirname);
        const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

        expect(e.name).to.equal('ComponentSetError');
        expect(e.message).to.equal(messages.getMessage('error_no_source_to_deploy'));
      }
    });
  });

  describe('retrieve', () => {
    it('should properly construct a retrieve operation', async () => {
      const connection = await testOrg.getConnection();
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
      const startStub = $$.SANDBOX.stub(expectedOperation, 'start').resolves();
      const constructorStub = $$.SANDBOX.stub()
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
      const connection = await testOrg.getConnection();
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
      const startStub = $$.SANDBOX.stub(expectedOperation, 'start').resolves();
      const constructorStub = $$.SANDBOX.stub()
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
      const connection = await testOrg.getConnection();
      const set = new ComponentSet([]);
      const operationArgs = {
        components: set,
        output: join('test', 'path'),
        usernameOrConnection: connection,
        packages: ['MyPackage'],
      };
      const expectedOperation = new MetadataApiRetrieve(operationArgs);
      const startStub = $$.SANDBOX.stub(expectedOperation, 'start').resolves();
      const constructorStub = $$.SANDBOX.stub()
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
    it('should add metadata member to package components', () => {
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

    it('should add metadata component to package components', () => {
      const set = new ComponentSet(undefined, registryAccess);
      const component = { fullName: 'bar', type: registry.types.staticresource };

      expect(set.size).to.equal(0);

      set.add(component);

      expect(Array.from(set)).to.deep.equal([component]);
    });

    it('should keep manifestComponents/components in sync', async () => {
      const set = new ComponentSet(undefined, registryAccess);
      const jerryComponent = { fullName: 'Jerry', type: registry.types.staticresource };
      const billComponent = new SourceComponent({ name: 'Bill', type: registry.types.staticresource });
      const philComponent = new SourceComponent({ name: 'Phil', type: registry.types.staticresource });

      expect(set.size).to.equal(0);

      set.add(jerryComponent);

      expect(set.size).to.equal(1); // @ts-ignore - private
      expect(set.manifestComponents.size).to.equal(1); // @ts-ignore - private
      expect(set.components.size).to.equal(1);
      const allToDeployObject = await set.getObject();

      set.add(philComponent, DestructiveChangesType.PRE); // @ts-ignore - private
      expect(set.manifestComponents.size).to.equal(1); // @ts-ignore - private
      expect(set.components.size).to.equal(2);

      set.add(billComponent, DestructiveChangesType.POST); // @ts-ignore - private
      expect(set.manifestComponents.size).to.equal(1); // @ts-ignore - private
      expect(set.components.size).to.equal(3);

      expect(await set.getObject()).to.deep.equal(allToDeployObject);
    });

    it('should add metadata component marked for delete to package components', () => {
      const set = new ComponentSet(undefined, registryAccess);
      expect(!!set.getTypesOfDestructiveChanges().length).to.be.false;

      const component = new SourceComponent({
        name: mixedContentSingleFile.COMPONENT.name,
        type: mixedContentSingleFile.COMPONENT.type,
        xml: mixedContentSingleFile.COMPONENT.xml,
      });
      set.add(component, DestructiveChangesType.POST);

      expect(!!set.getTypesOfDestructiveChanges().length).to.be.true;
      expect(set.getSourceComponents().first()?.isMarkedForDelete()).to.be.true;
      expect(set.has(component)).to.be.true;
    });

    it('should delete metadata from package components, if its present in destructive changes', () => {
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
      expect(set.getSourceComponents().first()?.isMarkedForDelete()).to.be.true;

      set.add(component);
      set.setDestructiveChangesType(DestructiveChangesType.PRE);
      expect(set.getDestructiveChangesType()).to.equal(DestructiveChangesType.PRE);
      expect(set.getSourceComponents().first()?.isMarkedForDelete()).to.be.true;
      expect(set.has(component)).to.be.true;
      expect(set.getSourceComponents().toArray().length).to.equal(1);
      expect(set.destructiveChangesPre.size).to.equal(0);
      expect(set.destructiveChangesPost.size).to.equal(1);
      // @ts-ignore - private
      expect(set.manifestComponents.size).to.equal(1);
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

    it('should correctly evaluate membership with decoded MetadataComponent key', () => {
      const set = new ComponentSet(undefined, registryAccess);
      const decodedComponent: MetadataComponent = {
        fullName: 'Broker__c-v1.1 Broker Layout',
        type: registry.types.layout,
      };
      const encodedComponent: MetadataComponent = {
        fullName: 'Broker__c-v1%2E1 Broker Layout',
        type: registry.types.layout,
      };

      expect(set.has(decodedComponent)).to.be.false;
      expect(set.has(encodedComponent)).to.be.false;

      set.add(decodedComponent);

      expect(set.has(encodedComponent)).to.be.true;
      expect(set.has(decodedComponent)).to.be.true;
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

  describe('getComponentFilenamesByNameAndType', () => {
    it('should correctly return DEB (DigitalExperienceBundle) component file paths', () => {
      const set = new ComponentSet([digitalExperienceBundle.DEB_COMPONENT], registryAccess);

      const deb: MetadataMember = {
        fullName: digitalExperienceBundle.BUNDLE_FULL_NAME,
        type: digitalExperienceBundle.DEB_TYPE.id,
      };

      expect(set.getComponentFilenamesByNameAndType(deb)).to.have.members([
        digitalExperienceBundle.BUNDLE_META_FILE_PATH,
      ]);
    });

    it('should correctly return DE (DigitalExperience) component file paths', () => {
      const set = new ComponentSet([digitalExperienceBundle.DE_COMPONENT], registryAccess);
      assert(typeof digitalExperienceBundle.DE_TYPE?.id === 'string');

      const de: MetadataMember = {
        fullName: digitalExperienceBundle.HOME_VIEW_FULL_NAME,
        type: digitalExperienceBundle.DE_TYPE.id,
      };

      expect(set.getComponentFilenamesByNameAndType(de)).to.have.members([
        digitalExperienceBundle.HOME_VIEW_PATH,
        join(digitalExperienceBundle.HOME_VIEW_PATH, 'content.json'),
        join(digitalExperienceBundle.HOME_VIEW_PATH, 'fr.json'),
        join(digitalExperienceBundle.HOME_VIEW_PATH, '_meta.json'),
      ]);
    });
  });
});
