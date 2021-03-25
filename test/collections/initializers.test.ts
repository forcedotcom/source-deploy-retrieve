/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { join, sep } from 'path';
import { createSandbox, SinonStub } from 'sinon';
import { ComponentSet, resolveSource } from '../../src';
import * as resolve from '../../src/metadata-registry';
import { mixedContentSingleFile, mockRegistry } from '../mock/registry';

const env = createSandbox();

describe('Initializers', () => {
  describe('resolveSource', () => {
    const resolved = new ComponentSet(
      [mixedContentSingleFile.MC_SINGLE_FILE_COMPONENT],
      mockRegistry
    );

    let resolveStub: SinonStub;

    beforeEach(() => {
      resolveStub = env.stub(resolve.MetadataResolver.prototype, 'getComponentsFromPath');
      resolveStub.returns(resolved);
    });

    afterEach(() => env.restore());

    it('should return result from metadata resolver call', () => {
      const fsPath = join(sep, 'project', 'force-app');

      const result = resolveSource(fsPath).toArray();
      const expected = resolved.toArray();

      expect(resolveStub.callCount).to.equal(1);
      expect(result).to.deep.equal(expected);
    });

    it('should resolve source with a single file path', () => {
      const fsPath = join(sep, 'project', 'force-app');

      resolveSource(fsPath).toArray();

      expect(resolveStub.callCount).to.equal(1);
      expect(resolveStub.firstCall.args[0]).to.equal(fsPath);
    });

    it('should resolve source with multiple file paths', () => {
      const fsPath = join(sep, 'project', 'force-app');
      const fsPath2 = join(sep, 'project', 'test-app');

      resolveSource([fsPath, fsPath2]);

      expect(resolveStub.callCount).to.equal(2);
      expect(resolveStub.firstCall.args[0]).to.equal(fsPath);
      expect(resolveStub.secondCall.args[0]).to.equal(fsPath2);
    });

    it('should resolve source with options object', () => {
      const resolverSpy = env.spy(resolve, 'MetadataResolver');
      const fsPath = join(sep, 'project', 'force-app');
      const tree = new resolve.VirtualTreeContainer([]);

      resolveSource({
        fsPaths: [fsPath],
        registry: mockRegistry,
        tree,
        inclusiveFilter: resolved,
      });

      // ensure resolver constructor was properly called
      expect(resolverSpy.callCount).to.equal(1);
      expect(resolverSpy.firstCall.args[0]).to.deep.equal(mockRegistry);
      expect(resolverSpy.firstCall.args[1]).to.deep.equal(tree);

      expect(resolveStub.callCount).to.equal(1);
      expect(resolveStub.firstCall.args[0]).to.equal(fsPath);
      expect(resolveStub.firstCall.args[1]).to.deep.equal(resolved);
    });

    it('should resolve source without optional options', () => {
      const resolverSpy = env.spy(resolve, 'MetadataResolver');
      const fsPath = join(sep, 'project', 'force-app');

      resolveSource({ fsPaths: [fsPath] });

      // ensure resolver constructor was properly called
      expect(resolverSpy.callCount).to.equal(1);
      expect(resolverSpy.firstCall.args[0]).to.equal(undefined);
      expect(resolverSpy.firstCall.args[1]).to.equal(undefined);

      expect(resolveStub.callCount).to.equal(1);
      expect(resolveStub.firstCall.args[0]).to.equal(fsPath);
    });
  });
});
