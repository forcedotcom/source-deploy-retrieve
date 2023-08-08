/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as fs from 'graceful-fs';
import * as sinon from 'sinon';
import { assert, expect } from 'chai';
import { stubMethod } from '@salesforce/ts-sinon';
import { SfError } from '@salesforce/core';
import { ComponentSet, ComponentSetBuilder, FromSourceOptions } from '../../src';

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
      fromSourceStub = stubMethod(sandbox, ComponentSet, 'fromSource');
      fromManifestStub = stubMethod(sandbox, ComponentSet, 'fromManifest');
      fromConnectionStub = stubMethod(sandbox, ComponentSet, 'fromConnection');
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
      expect(fromSourceStub.calledOnceWith(expectedArg)).to.equal(true);
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
      expect(fromSourceStub.calledOnceWith(expectedArg)).to.equal(true);
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
      expect(fromSourceStub.calledOnceWith(expectedArg)).to.equal(true);
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
      expect(fromSourceStub.calledOnceWith(expectedArg)).to.equal(true);
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
        expect(fromSourceStub.notCalled).to.equal(true);
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
      expect(fromSourceStub.notCalled).to.equal(true);
      expect(fromManifestStub.notCalled).to.equal(true);
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
      expect(fromSourceStub.calledOnce).to.equal(true);
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
      expect(fromSourceStub.calledOnce).to.equal(true);
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
        expect((e as Error).message).to.include('The specified metadata type is unsupported: [notatype]');
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
      expect(fromSourceStub.calledOnce).to.equal(true);
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
      expect(fromSourceStub.calledOnce).to.equal(true);
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
      expect(fromSourceStub.calledTwice).to.equal(true);
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
      expect(fromSourceStub.calledOnce).to.equal(true);
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
      expect(fromManifestStub.calledOnce).to.equal(true);
      expect(fromManifestStub.firstCall.args[0]).to.deep.equal({
        forceAddWildcards: true,
        manifestPath: options.manifest.manifestPath,
        resolveSourcePaths: [packageDir1],
        destructivePre: undefined,
        destructivePost: undefined,
      });
      expect(compSet.size).to.equal(1);
      expect(compSet.has(apexClassComponent)).to.equal(true);
    });

    it('should create ComponentSet from org connection', async () => {
      componentSet.add(apexClassComponent);
      fromConnectionStub.resolves(componentSet);
      const options = {
        sourcepath: undefined,
        metadata: undefined,
        manifest: undefined,
        org: {
          username: 'manifest-test@org.com',
          exclude: [],
        },
      };

      const compSet = await ComponentSetBuilder.build(options);
      expect(fromConnectionStub.calledOnce).to.equal(true);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(fromConnectionStub.firstCall.firstArg['usernameOrConnection']).equal(options.org.username);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(fromConnectionStub.firstCall.firstArg['componentFilter'].call()).equal(true);
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
      expect(fromManifestStub.firstCall.args[0]).to.deep.equal({
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
  });
});
