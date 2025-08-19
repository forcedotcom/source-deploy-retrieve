/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { createSandbox } from 'sinon';
import { Logger } from '@salesforce/core';
import { SourceComponent } from '../../src/resolve/sourceComponent';
import { ComponentSet } from '../../src/collections/componentSet';
import { RegistryAccess } from '../../src/registry/registryAccess';
import { ZipTreeContainer } from '../../src/resolve/treeContainers';
import { MetadataConverter } from '../../src/convert/metadataConverter';
import { extract } from '../../src/client/retrieveExtract';
import { MetadataApiRetrieveOptions } from '../../src/client/types';


describe('retrieveExtract    Integration', () => {
  const sandbox = createSandbox();
  let logger: Logger;
  let registry: RegistryAccess;

  beforeEach(() => {
    logger = Logger.childFromRoot('test');
    registry = new RegistryAccess();
    sandbox.stub(logger, 'debug');
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('ForceIgnore behavior during retrieve', () => {
    it('should disable ForceIgnore during initial processing (useFsForceIgnore: false)', async () => {
      // Mock zip buffer and tree
      const mockZipBuffer = Buffer.from('mock zip content');
      const mockTree = {} as ZipTreeContainer;
      
      // Mock ComponentSet.fromSource to verify useFsForceIgnore is false
      const mockComponentSet = new ComponentSet([], registry);
      sandbox.stub(mockComponentSet, 'getSourceComponents').returns({ toArray: () => [] } as never);
      const fromSourceStub = sandbox.stub(ComponentSet, 'fromSource').returns(mockComponentSet);

      // Mock ZipTreeContainer.create
      sandbox.stub(ZipTreeContainer, 'create').resolves(mockTree);

      // Mock MetadataConverter
      sandbox.stub(MetadataConverter.prototype, 'convert').resolves({
        converted: [],
        deleted: []
      });

      const options: MetadataApiRetrieveOptions = {
        output: '/test/output',
        registry,
        merge: false,
        usernameOrConnection: 'test@example.com'
      };

      await extract({
        zip: mockZipBuffer,
        options,
        logger,
      });

      // Verify that ComponentSet.fromSource was called with useFsForceIgnore: false
      expect(fromSourceStub.calledOnce).to.be.true;
      const fromSourceArgs = fromSourceStub.firstCall.args[0];
      expect(fromSourceArgs).to.have.property('useFsForceIgnore', false);
    });

    it('should apply ForceIgnore filtering after conversion to source format', async () => {
      const mockZipBuffer = Buffer.from('mock zip content');
      const mockTree = {} as ZipTreeContainer;
      
      sandbox.stub(ZipTreeContainer, 'create').resolves(mockTree);
      
      const mockComponentSet = new ComponentSet([], registry);
      sandbox.stub(mockComponentSet, 'getSourceComponents').returns({ toArray: () => [] } as never);
      sandbox.stub(ComponentSet, 'fromSource').returns(mockComponentSet);


      // Create real SourceComponent instances for testing
      const allowedComponent = new SourceComponent({
        name: 'AllowedClass',
        type: registry.getTypeByName('ApexClass'),
        xml: '/test/force-app/main/default/classes/AllowedClass.cls-meta.xml',
        content: '/test/force-app/main/default/classes/AllowedClass.cls'
      });
      
      const ignoredComponent = new SourceComponent({
        name: 'IgnoredClass',
        type: registry.getTypeByName('ApexClass'), 
        xml: '/test/force-app/main/default/classes/IgnoredClass.cls-meta.xml',
        content: '/test/force-app/main/default/classes/IgnoredClass.cls'
      });
      
      const noXmlComponent = new SourceComponent({
        name: 'NoXmlComponent',
        type: registry.getTypeByName('StaticResource'),
        content: '/test/force-app/main/default/staticresources/test.resource'
      });

      // Mock getForceIgnore to control filtering behavior with proper typing
      sandbox.stub(allowedComponent, 'getForceIgnore').returns({
        denies: () => false, // This should NOT be ignored
        accepts: () => true
      } as unknown as ReturnType<SourceComponent['getForceIgnore']>);
      
      sandbox.stub(ignoredComponent, 'getForceIgnore').returns({
        denies: (filePath: string) => filePath.includes('IgnoredClass'), // This SHOULD be ignored
        accepts: (filePath: string) => !filePath.includes('IgnoredClass')
      } as unknown as ReturnType<SourceComponent['getForceIgnore']>);
      
      sandbox.stub(noXmlComponent, 'getForceIgnore').returns({
        denies: () => false,
        accepts: () => true
      } as unknown as ReturnType<SourceComponent['getForceIgnore']>);

      // Mock converter to return test data that will trigger the filtering logic
      sandbox.stub(MetadataConverter.prototype, 'convert').resolves({
        converted: [allowedComponent, ignoredComponent, noXmlComponent],
        deleted: []
      });


      const options: MetadataApiRetrieveOptions = {
        output: '/test/output',
        registry,
        merge: false,
        usernameOrConnection: 'test@example.com'
      };

      const result = await extract({
        zip: mockZipBuffer,
        options,
        logger,
      });


      expect(result.componentSet).to.be.instanceOf(ComponentSet);
      expect(result.componentSet.getSourceComponents().toArray()).to.have.length(2);
      expect(result.partialDeleteFileResponses).to.be.an('array');

    });

    it('should handle merge operations with forceIgnoredPaths', async () => {
      const mockForceIgnoredPaths = new Set(['/ignored/path1', '/ignored/path2']);
      const mainComponents = new ComponentSet([], registry);
      mainComponents.forceIgnoredPaths = mockForceIgnoredPaths;

      const mockZipBuffer = Buffer.from('mock zip content');
      const mockTree = {} as ZipTreeContainer;
      
      sandbox.stub(ZipTreeContainer, 'create').resolves(mockTree);
      
      const mockComponentSet = new ComponentSet([], registry);
      sandbox.stub(mockComponentSet, 'getSourceComponents').returns({ toArray: () => [] } as never);
      sandbox.stub(ComponentSet, 'fromSource').returns(mockComponentSet);

      const convertStub = sandbox.stub(MetadataConverter.prototype, 'convert').resolves({
        converted: [],
        deleted: []
      });

      const options: MetadataApiRetrieveOptions = {
        output: '/test/output',
        registry,
        merge: true,
        usernameOrConnection: 'test@example.com'
      };

      await extract({
        zip: mockZipBuffer,
        options,
        logger,
        mainComponents
      });

      // Verify that outputConfig was called correctly
      expect(convertStub.calledOnce).to.be.true;
      const outputConfig = convertStub.firstCall.args[2];
      expect(outputConfig).to.have.property('type', 'merge');
    });
  });
});