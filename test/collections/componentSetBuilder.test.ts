/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import { join } from 'node:path';
import fs from 'graceful-fs';
import * as sinon from 'sinon';
import { assert, expect, config } from 'chai';
import { Connection, SfError } from '@salesforce/core';
import { instantiateContext, MockTestOrgData, restoreContext, stubContext } from '@salesforce/core/testSetup';
import { RegistryAccess } from '../../src/registry/registryAccess';
import { ComponentSetBuilder, entryToTypeAndName } from '../../src/collections/componentSetBuilder';
import { ComponentSet } from '../../src/collections/componentSet';
import { FromSourceOptions } from '../../src/collections/types';
import { MetadataResolver, SourceComponent } from '../../src';

config.truncateThreshold = 0;

describe('ComponentSetBuilder', () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  const apexClassComponent = {
    type: 'ApexClass',
    fullName: 'MyClass',
    content: 'MyClass.cls',
    xml: 'MyClass.cls-meta.xml',
  };

  const apexClassWildcardMatch = {
    type: 'ApexClass',
    fullName: 'MyClassIsAwesome',
    content: 'MyClassIsAwesome.cls',
    xml: 'MyClassIsAwesome.cls-meta.xml',
  };

  const apexClassWildcardNoMatch = {
    type: 'ApexClass',
    fullName: 'MyTableIsAwesome',
    content: 'MyTableIsAwesome.cls',
    xml: 'MyTableIsAwesome.cls-meta.xml',
  };

  const customObjectComponent = {
    type: 'CustomObject',
    fullName: 'MyCustomObject__c',
    content: undefined,
    xml: 'MyCustomObject__c.object-meta.xml',
  };

  describe('build', () => {
    let componentSet: ComponentSet;
    let fileExistsSyncStub: sinon.SinonStub;
    let fromSourceStub: sinon.SinonStub;
    let fromManifestStub: sinon.SinonStub;
    let fromConnectionStub: sinon.SinonStub;

    beforeEach(() => {
      fileExistsSyncStub = sandbox.stub(fs, 'existsSync');
      fromSourceStub = sandbox.stub(ComponentSet, 'fromSource');
      fromManifestStub = sandbox.stub(ComponentSet, 'fromManifest');
      fromConnectionStub = sandbox.stub(ComponentSet, 'fromConnection');
      componentSet = new ComponentSet();
    });

    it('should create ComponentSet from single sourcepath', async () => {
      fileExistsSyncStub.returns(true);
      componentSet.add(apexClassComponent);
      fromSourceStub.returns(componentSet);
      const sourcepath = ['force-app'];

      const compSet = await ComponentSetBuilder.build({
        sourcepath,
        manifest: undefined,
        metadata: undefined,
      });

      const expectedArg = { fsPaths: [path.resolve(sourcepath[0])] };
      expect(fromSourceStub.callCount).to.equal(1);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { registry, ...argWithoutRegistry } = fromSourceStub.args[0][0];
      expect(argWithoutRegistry).to.deep.equal(expectedArg);
      expect(compSet.size).to.equal(1);
      expect(compSet.has(apexClassComponent)).to.equal(true);
    });

    it('should create ComponentSet from multiple sourcepaths', async () => {
      fileExistsSyncStub.returns(true);
      componentSet.add(apexClassComponent);
      componentSet.add(customObjectComponent);
      fromSourceStub.returns(componentSet);
      const sourcepath = ['force-app', 'my-app'];

      const compSet = await ComponentSetBuilder.build({
        sourcepath,
        manifest: undefined,
        metadata: undefined,
      });
      const expectedPath1 = path.resolve(sourcepath[0]);
      const expectedPath2 = path.resolve(sourcepath[1]);
      const expectedArg = { fsPaths: [expectedPath1, expectedPath2] };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { registry, ...argWithoutRegistry } = fromSourceStub.args[0][0];
      expect(argWithoutRegistry).to.deep.equal(expectedArg);
      expect(compSet.size).to.equal(2);
      expect(compSet.has(apexClassComponent)).to.equal(true);
      expect(compSet.has(customObjectComponent)).to.equal(true);
    });

    it('should create ComponentSet with overridden apiVersion', async () => {
      fileExistsSyncStub.returns(true);
      fromSourceStub.returns(componentSet);
      const sourcepath = ['force-app'];
      const options = {
        sourcepath,
        manifest: undefined,
        metadata: undefined,
        apiversion: '50.0',
      };

      const compSet = await ComponentSetBuilder.build(options);
      const expectedArg = { fsPaths: [path.resolve(sourcepath[0])] };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { registry, ...argWithoutRegistry } = fromSourceStub.args[0][0];
      expect(argWithoutRegistry).to.deep.equal(expectedArg);
      expect(compSet.size).to.equal(0);
      expect(compSet.apiVersion).to.equal(options.apiversion);
    });

    it('should create ComponentSet with sourceApiVersion', async () => {
      fileExistsSyncStub.returns(true);
      fromSourceStub.returns(componentSet);
      const sourcepath = ['force-app'];
      const options = {
        sourcepath,
        manifest: undefined,
        metadata: undefined,
        sourceapiversion: '50.0',
      };

      const compSet = await ComponentSetBuilder.build(options);
      const expectedArg = { fsPaths: [path.resolve(sourcepath[0])] };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { registry, ...argWithoutRegistry } = fromSourceStub.args[0][0];
      expect(argWithoutRegistry).to.deep.equal(expectedArg);
      expect(compSet.size).to.equal(0);
      expect(compSet.sourceApiVersion).to.equal(options.sourceapiversion);
    });

    it('should throw with an invalid sourcepath', async () => {
      fileExistsSyncStub.returns(false);
      const sourcepath = ['nonexistent'];
      try {
        await ComponentSetBuilder.build({
          sourcepath,
          manifest: undefined,
          metadata: undefined,
        });
        assert(false, 'should have thrown SfError');
      } catch (e: unknown) {
        const err = e as SfError;
        expect(fromSourceStub.callCount).to.equal(0);
        expect(err.message).to.include(sourcepath[0]);
      }
    });

    it('should create empty ComponentSet from packagenames', async () => {
      fileExistsSyncStub.returns(true);

      const compSet = await ComponentSetBuilder.build({
        sourcepath: undefined,
        manifest: undefined,
        metadata: undefined,
        packagenames: ['mypackage'],
      });
      expect(compSet.size).to.equal(0);
      expect(fromSourceStub.callCount).to.equal(0);
      expect(fromManifestStub.callCount).to.equal(0);
    });

    it('should create ComponentSet from wildcarded metadata (ApexClass)', async () => {
      componentSet.add(apexClassComponent);
      fromSourceStub.returns(componentSet);
      const packageDir1 = path.resolve('force-app');

      const compSet = await ComponentSetBuilder.build({
        sourcepath: undefined,
        manifest: undefined,
        metadata: {
          metadataEntries: ['ApexClass'],
          directoryPaths: [packageDir1],
        },
      });
      expect(fromSourceStub.callCount).to.equal(1);
      const fromSourceArgs = fromSourceStub.firstCall.args[0] as FromSourceOptions;
      expect(fromSourceArgs).to.have.deep.property('fsPaths', [packageDir1]);
      const filter = new ComponentSet();
      filter.add({ type: 'ApexClass', fullName: '*' });
      assert(fromSourceArgs.include instanceof ComponentSet, 'include should be a ComponentSet');
      expect(fromSourceArgs.include.getSourceComponents()).to.deep.equal(filter.getSourceComponents());
      expect(compSet.size).to.equal(2);
      expect(compSet.has(apexClassComponent)).to.equal(true);
      expect(compSet.has({ type: 'ApexClass', fullName: '*' })).to.equal(true);
    });

    it('should create ComponentSet from metadata with spaces between : (ApexClass: MyApexClass)', async () => {
      componentSet.add(apexClassComponent);
      fromSourceStub.returns(componentSet);
      const packageDir1 = path.resolve('force-app');

      const compSet = await ComponentSetBuilder.build({
        sourcepath: undefined,
        manifest: undefined,
        metadata: {
          metadataEntries: ['ApexClass: MyApexClass'],
          directoryPaths: [packageDir1],
        },
      });
      expect(fromSourceStub.callCount).to.equal(1);
      const fromSourceArgs = fromSourceStub.firstCall.args[0] as FromSourceOptions;
      expect(fromSourceArgs).to.have.deep.property('fsPaths', [packageDir1]);
      const filter = new ComponentSet();
      filter.add({ type: 'ApexClass', fullName: 'MyApexClass' });
      assert(fromSourceArgs.include instanceof ComponentSet, 'include should be a ComponentSet');
      expect(fromSourceArgs.include.getSourceComponents()).to.deep.equal(filter.getSourceComponents());
      expect(compSet.size).to.equal(2);
      expect(compSet.has(apexClassComponent)).to.equal(true);
      expect(compSet.has({ type: 'ApexClass', fullName: 'MyApexClass' })).to.equal(true);
    });

    it('should throw an error when it cant resolve a metadata type (Metadata)', async () => {
      const packageDir1 = path.resolve('force-app');

      try {
        await ComponentSetBuilder.build({
          sourcepath: undefined,
          manifest: undefined,
          metadata: {
            metadataEntries: ['NotAType', 'ApexClass:MyClass'],
            directoryPaths: [packageDir1],
          },
        });
        assert.fail('the above should throw an error');
      } catch (e) {
        expect(e).to.not.be.null;
        expect((e as Error).message).to.include("Missing metadata type definition in registry for id 'NotAType'");
      }
    });

    it('should create ComponentSet from specific metadata (ApexClass:MyClass)', async () => {
      componentSet.add(apexClassComponent);
      fromSourceStub.returns(componentSet);
      const packageDir1 = path.resolve('force-app');

      const compSet = await ComponentSetBuilder.build({
        sourcepath: undefined,
        manifest: undefined,
        metadata: {
          metadataEntries: ['ApexClass:MyClass'],
          directoryPaths: [packageDir1],
        },
      });
      expect(fromSourceStub.callCount).to.equal(1);
      const fromSourceArgs = fromSourceStub.firstCall.args[0] as FromSourceOptions;
      expect(fromSourceArgs).to.have.deep.property('fsPaths', [packageDir1]);
      const filter = new ComponentSet();
      filter.add({ type: 'ApexClass', fullName: 'MyClass' });
      assert(fromSourceArgs.include instanceof ComponentSet, 'include should be a ComponentSet');
      expect(fromSourceArgs.include.getSourceComponents()).to.deep.equal(filter.getSourceComponents());
      expect(compSet.size).to.equal(1);
      expect(compSet.has(apexClassComponent)).to.equal(true);
    });

    it('should create ComponentSet from multiple metadata (ApexClass:MyClass,CustomObject)', async () => {
      componentSet.add(apexClassComponent);
      componentSet.add(customObjectComponent);
      fromSourceStub.returns(componentSet);
      const packageDir1 = path.resolve('force-app');

      const compSet = await ComponentSetBuilder.build({
        sourcepath: undefined,
        manifest: undefined,
        metadata: {
          metadataEntries: ['ApexClass:MyClass', 'CustomObject'],
          directoryPaths: [packageDir1],
        },
      });
      expect(fromSourceStub.callCount).to.equal(1);
      expect(compSet.forceIgnoredPaths).to.equal(undefined);
      const fromSourceArgs = fromSourceStub.firstCall.args[0] as FromSourceOptions;
      expect(fromSourceArgs).to.have.deep.property('fsPaths', [packageDir1]);
      const filter = new ComponentSet();
      filter.add({ type: 'ApexClass', fullName: 'MyClass' });
      filter.add({ type: 'CustomObject', fullName: '*' });
      assert(fromSourceArgs.include instanceof ComponentSet, 'include should be a ComponentSet');
      expect(fromSourceArgs.include.getSourceComponents()).to.deep.equal(filter.getSourceComponents());
      expect(compSet.size).to.equal(3);
      expect(compSet.has(apexClassComponent)).to.equal(true);
      expect(compSet.has(customObjectComponent)).to.equal(true);
      expect(compSet.has({ type: 'CustomObject', fullName: '*' })).to.equal(true);
    });
    it('should create ComponentSet from multiple metadata (ApexClass:MyClass,CustomObject), one of which is forceignored', async () => {
      const customObjSourceComponent = new SourceComponent({
        name: 'myCO',
        content: join('my', 'path', 'to', 'a', 'customobject.xml'),
        parentType: undefined,
        type: { id: 'customobject', directoryName: 'objects', name: 'CustomObject' },
        xml: '',
      });

      componentSet.add(apexClassComponent);
      componentSet.add(customObjSourceComponent);

      componentSet.add(apexClassWildcardMatch);
      componentSet.forceIgnoredPaths = new Set<string>();
      componentSet.forceIgnoredPaths.add(join('my', 'path', 'to', 'a', 'customobject.xml'));
      fromSourceStub.returns(componentSet);
      const packageDir1 = path.resolve('force-app');

      sandbox.stub(MetadataResolver.prototype, 'getComponentsFromPath').returns([customObjSourceComponent]);

      const compSet = await ComponentSetBuilder.build({
        sourcepath: undefined,
        manifest: undefined,
        metadata: {
          metadataEntries: ['ApexClass:MyClass', 'ApexClass:MyClassIsAwesome', 'CustomObject:myCO'],
          directoryPaths: [packageDir1],
        },
      });
      expect(fromSourceStub.callCount).to.equal(1);
      expect(compSet.forceIgnoredPaths?.size).to.equal(1);
      expect(compSet.forceIgnoredPaths).to.deep.equal(new Set([join('my', 'path', 'to', 'a', 'customobject.xml')]));
      const fromSourceArgs = fromSourceStub.firstCall.args[0] as FromSourceOptions;
      expect(fromSourceArgs).to.have.deep.property('fsPaths', [packageDir1]);
      const filter = new ComponentSet();
      filter.add({ type: 'ApexClass', fullName: 'MyClass' });
      filter.add({ type: 'ApexClass', fullName: 'MyClassIsAwesome' });
      filter.add({ type: 'CustomObject', fullName: 'myCO' });
      assert(fromSourceArgs.include instanceof ComponentSet, 'include should be a ComponentSet');
      expect(fromSourceArgs.include.getSourceComponents()).to.deep.equal(filter.getSourceComponents());
      expect(compSet.size).to.equal(3);
      expect(compSet.has(apexClassComponent)).to.equal(true);
      expect(compSet.has(customObjectComponent)).to.equal(false);
      expect(compSet.has({ type: 'CustomObject', fullName: '*' })).to.equal(false);
      expect(compSet.has({ type: 'ApexClass', fullName: 'MyClass' })).to.equal(true);
      expect(compSet.has({ type: 'ApexClass', fullName: 'MyClassIsAwesome' })).to.equal(true);
    });

    it('should create ComponentSet from partial-match fullName (ApexClass:Prop*)', async () => {
      componentSet.add(apexClassComponent);
      componentSet.add(apexClassWildcardMatch);
      fromSourceStub.returns(componentSet);
      const packageDir1 = path.resolve('force-app');

      const compSet = await ComponentSetBuilder.build({
        sourcepath: undefined,
        manifest: undefined,
        metadata: {
          metadataEntries: ['ApexClass:MyClas*'],
          directoryPaths: [packageDir1],
        },
      });
      expect(fromSourceStub.callCount).to.equal(2);
      const fromSourceArgs = fromSourceStub.firstCall.args[0] as FromSourceOptions;
      expect(fromSourceArgs).to.have.deep.property('fsPaths', [packageDir1]);
      const filter = new ComponentSet();
      filter.add({ type: 'ApexClass', fullName: 'MyClass' });
      filter.add({ type: 'ApexClass', fullName: 'MyClassIsAwesome' });
      filter.add({ type: 'ApexClass', fullName: 'MyTableIsAwesome' });
      assert(fromSourceArgs.include instanceof ComponentSet, 'include should be a ComponentSet');
      expect(fromSourceArgs.include.getSourceComponents()).to.deep.equal(filter.getSourceComponents());
      expect(compSet.size).to.equal(2);
      expect(compSet.has(apexClassComponent)).to.equal(true);
      expect(compSet.has(apexClassWildcardMatch)).to.equal(true);
      expect(compSet.has(apexClassWildcardNoMatch)).to.equal(false);
    });

    it('should create ComponentSet from metadata and multiple package directories', async () => {
      componentSet.add(apexClassComponent);
      const apexClassComponent2 = { type: 'ApexClass', fullName: 'MyClass2' };
      componentSet.add(apexClassComponent2);
      fromSourceStub.returns(componentSet);
      const packageDir1 = path.resolve('force-app');
      const packageDir2 = path.resolve('my-app');

      const compSet = await ComponentSetBuilder.build({
        sourcepath: undefined,
        manifest: undefined,
        metadata: {
          metadataEntries: ['ApexClass'],
          directoryPaths: [packageDir1, packageDir2],
        },
      });
      expect(fromSourceStub.callCount).to.equal(1);
      const fromSourceArgs = fromSourceStub.firstCall.args[0] as FromSourceOptions;
      expect(fromSourceArgs).to.have.deep.property('fsPaths', [packageDir1, packageDir2]);
      const filter = new ComponentSet();
      filter.add({ type: 'ApexClass', fullName: '*' });
      assert(fromSourceArgs.include instanceof ComponentSet, 'include should be a ComponentSet');
      expect(fromSourceArgs.include.getSourceComponents()).to.deep.equal(filter.getSourceComponents());
      expect(compSet.size).to.equal(3);
      expect(compSet.has(apexClassComponent)).to.equal(true);
      expect(compSet.has(apexClassComponent2)).to.equal(true);
      expect(compSet.has({ type: 'ApexClass', fullName: '*' })).to.equal(true);
    });

    it('should create ComponentSet from manifest', async () => {
      fileExistsSyncStub.returns(true);
      componentSet.add(apexClassComponent);
      fromManifestStub.resolves(componentSet);
      const packageDir1 = path.resolve('force-app');
      const options = {
        sourcepath: undefined,
        metadata: undefined,
        manifest: {
          manifestPath: 'apex-package.xml',
          directoryPaths: [packageDir1],
        },
      };

      const compSet = await ComponentSetBuilder.build(options);
      expect(fromManifestStub.callCount).to.equal(1);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { registry, ...argWithoutRegistry } = fromManifestStub.firstCall.args[0];
      expect(argWithoutRegistry).to.deep.equal({
        forceAddWildcards: true,
        manifestPath: options.manifest.manifestPath,
        resolveSourcePaths: [packageDir1],
        destructivePre: undefined,
        destructivePost: undefined,
      });
      expect(compSet.size).to.equal(1);
      expect(compSet.has(apexClassComponent)).to.equal(true);
    });

    it('should create ComponentSet from manifest and multiple package', async () => {
      fileExistsSyncStub.returns(true);

      componentSet.add(apexClassComponent);
      const apexClassComponent2 = { type: 'ApexClass', fullName: 'MyClass2' };
      componentSet.add(apexClassComponent2);
      fromManifestStub.onFirstCall().resolves(componentSet);
      const packageDir1 = path.resolve('force-app');
      const packageDir2 = path.resolve('my-app');
      const options = {
        sourcepath: undefined,
        metadata: undefined,
        manifest: {
          manifestPath: 'apex-package.xml',
          directoryPaths: [packageDir1, packageDir2],
        },
      };

      const compSet = await ComponentSetBuilder.build(options);
      expect(fromManifestStub.callCount).to.equal(1);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { registry, ...argWithoutRegistry } = fromManifestStub.firstCall.args[0];
      expect(argWithoutRegistry).to.deep.equal({
        forceAddWildcards: true,
        manifestPath: options.manifest.manifestPath,
        resolveSourcePaths: [packageDir1, packageDir2],
        destructivePre: undefined,
        destructivePost: undefined,
      });
      expect(compSet.size).to.equal(2);
      expect(compSet.has(apexClassComponent)).to.equal(true);
      expect(compSet.has(apexClassComponent2)).to.equal(true);
    });

    describe('from org', () => {
      const $$ = instantiateContext();
      const testOrg = new MockTestOrgData();
      let connection: Connection;

      beforeEach(async () => {
        stubContext($$);
        await $$.stubAuths(testOrg);
        connection = await testOrg.getConnection();
        $$.SANDBOX.stub(Connection, 'create').resolves(connection);
      });

      afterEach(() => {
        restoreContext($$);
      });

      it('should create ComponentSet from org connection', async () => {
        componentSet.add(apexClassComponent);
        fromConnectionStub.resolves(componentSet);
        const options = {
          sourcepath: undefined,
          metadata: undefined,
          manifest: undefined,
          org: {
            username: testOrg.username,
            exclude: [],
          },
        };

        const compSet = await ComponentSetBuilder.build(options);
        expect(fromConnectionStub.callCount).to.equal(1);
        const fromConnectionArgs = fromConnectionStub.firstCall.firstArg;
        expect(fromConnectionArgs).has.property('usernameOrConnection').and.instanceOf(Connection);
        expect(fromConnectionArgs['usernameOrConnection'].getUsername()).to.equal(options.org.username);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        expect(fromConnectionArgs['componentFilter'].call()).equal(true);
        expect(compSet.size).to.equal(1);
        expect(compSet.has(apexClassComponent)).to.equal(true);
      });

      it('should create ComponentSet from org connection and metadata', async () => {
        const mdCompSet = new ComponentSet();
        mdCompSet.add(apexClassComponent);

        fromSourceStub.returns(mdCompSet);
        const packageDir1 = path.resolve('force-app');

        componentSet.add(apexClassWildcardMatch);
        fromConnectionStub.resolves(componentSet);
        const options = {
          sourcepath: undefined,
          metadata: {
            metadataEntries: ['ApexClass:MyClas*'],
            directoryPaths: [packageDir1],
          },
          manifest: undefined,
          org: {
            username: testOrg.username,
            exclude: [],
          },
        };

        const compSet = await ComponentSetBuilder.build(options);
        expect(fromSourceStub.callCount).to.equal(0);
        expect(fromConnectionStub.callCount).to.equal(1);
        expect(compSet.size).to.equal(1);
        expect(compSet.has(apexClassComponent)).to.equal(false);
        expect(compSet.has(apexClassWildcardMatch)).to.equal(true);
      });

      describe('Agent pseudo type', () => {
        const genAiPlannerId = '16jSB000000H3JFYA0';
        const genAiPlannerId15 = '16jSB000000H3JF';
        const packageDir1 = path.resolve('force-app');
        const botComponent = {
          type: 'Bot',
          fullName: 'MyBot',
          xml: 'MyBot.bot-meta.xml',
        };
        const genAiPlannerComponent = {
          type: 'GenAiPlanner',
          fullName: 'MyGenAiPlanner',
          xml: 'MyGenAiPlanner.genAiPlanner-meta.xml',
        };
        const genAiPluginComponent = {
          type: 'GenAiPlugin',
          fullName: `p_${genAiPlannerId15}_MyGenAiPlugin`,
          xml: `p_${genAiPlannerId15}_MyGenAiPlugin.genAiPlugin-meta.xml`,
        };
        let singleRecordQueryStub: sinon.SinonStub;
        let queryStub: sinon.SinonStub;

        beforeEach(() => {
          // Stub queries for agent metadata (GenAiPlanner and GenAiPlugin)
          singleRecordQueryStub = $$.SANDBOX.stub(connection, 'singleRecordQuery');
          queryStub = $$.SANDBOX.stub(connection.tooling, 'query');
        });

        it('should create ComponentSet from org connection and wildcarded Agent', async () => {
          const mdCompSet = new ComponentSet();
          mdCompSet.add(botComponent);
          mdCompSet.add(genAiPlannerComponent);
          mdCompSet.add(genAiPluginComponent);

          fromConnectionStub.resolves(mdCompSet);
          const options = {
            metadata: {
              metadataEntries: ['Agent'],
              directoryPaths: [packageDir1],
            },
            org: {
              username: testOrg.username,
              exclude: [],
            },
          };

          const compSet = await ComponentSetBuilder.build(options);
          expect(singleRecordQueryStub.callCount).to.equal(0);
          expect(queryStub.callCount).to.equal(0);
          expect(fromConnectionStub.callCount).to.equal(1);
          const fromConnectionArgs = fromConnectionStub.firstCall.args[0];
          const expectedMdTypes = ['Bot', 'BotVersion', 'GenAiPlanner', 'GenAiPlugin'];
          expect(fromConnectionArgs).to.have.deep.property('metadataTypes', expectedMdTypes);
          expect(compSet.getSourceComponents()).to.deep.equal(mdCompSet.getSourceComponents());
        });

        it('should create ComponentSet from org connection and Agent developer name', async () => {
          const botName = botComponent.fullName;
          const srq = `SELECT Id FROM GenAiPlannerDefinition WHERE DeveloperName = '${botName}'`;
          const query = `SELECT DeveloperName FROM GenAiPluginDefinition WHERE DeveloperName LIKE 'p_${genAiPlannerId15}%'`;
          singleRecordQueryStub.withArgs(srq, { tooling: true }).resolves({ Id: genAiPlannerId });
          queryStub.withArgs(query).resolves({ records: [{ DeveloperName: genAiPluginComponent.fullName }] });

          const mdCompSet = new ComponentSet();
          mdCompSet.add(botComponent);
          mdCompSet.add(genAiPlannerComponent);
          mdCompSet.add(genAiPluginComponent);

          fromConnectionStub.resolves(mdCompSet);
          const options = {
            metadata: {
              metadataEntries: [`Agent:${botName}`],
              directoryPaths: [packageDir1],
            },
            org: {
              username: testOrg.username,
              exclude: [],
            },
          };

          const compSet = await ComponentSetBuilder.build(options);
          expect(singleRecordQueryStub.callCount, 'Expected singleRecordQuery stub to be called').to.equal(1);
          expect(queryStub.callCount, 'Expected tooling query stub to be called').to.equal(1);
          expect(fromConnectionStub.callCount).to.equal(1);
          const fromConnectionArgs = fromConnectionStub.firstCall.args[0];
          const expectedMdTypes = ['Bot', 'BotVersion', 'GenAiPlanner', 'GenAiPlugin'];
          expect(fromConnectionArgs).to.have.deep.property('metadataTypes', expectedMdTypes);
          expect(compSet.getSourceComponents()).to.deep.equal(mdCompSet.getSourceComponents());
        });
      });
    });
  });
});

describe('entryToTypeAndName', () => {
  const reg = new RegistryAccess();
  it('basic type', () => {
    expect(entryToTypeAndName(reg)('ApexClass:MyClass')).to.deep.equal({
      type: reg.getTypeByName('ApexClass'),
      metadataName: 'MyClass',
    });
  });
  it('handles wildcard', () => {
    expect(entryToTypeAndName(reg)('ApexClass:*')).to.deep.equal({
      type: reg.getTypeByName('ApexClass'),
      metadataName: '*',
    });
  });
  it('creates wildcard when no name is passed', () => {
    expect(entryToTypeAndName(reg)('ApexClass')).to.deep.equal({
      type: reg.getTypeByName('ApexClass'),
      metadataName: '*',
    });
  });
  it('leading spaces in name are trimmed', () => {
    expect(entryToTypeAndName(reg)('Layout: My Layout')).to.deep.equal({
      type: reg.getTypeByName('Layout'),
      metadataName: 'My Layout',
    });
  });
  it('trailing spaces in name are trimmed', () => {
    expect(entryToTypeAndName(reg)('Layout:My Layout ')).to.deep.equal({
      type: reg.getTypeByName('Layout'),
      metadataName: 'My Layout',
    });
  });
  it('spaces in name', () => {
    expect(entryToTypeAndName(reg)('Layout:My Layout')).to.deep.equal({
      type: reg.getTypeByName('Layout'),
      metadataName: 'My Layout',
    });
  });
  it('colons in name', () => {
    expect(entryToTypeAndName(reg)('Layout:My:Colon:Layout')).to.deep.equal({
      type: reg.getTypeByName('Layout'),
      metadataName: 'My:Colon:Layout',
    });
  });
  it('colons and spaces in name', () => {
    expect(entryToTypeAndName(reg)('Layout:My : Colon : Layout')).to.deep.equal({
      type: reg.getTypeByName('Layout'),
      metadataName: 'My : Colon : Layout',
    });
  });
});
