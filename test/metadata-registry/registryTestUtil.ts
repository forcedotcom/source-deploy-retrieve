/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { createSandbox, SinonSandbox } from 'sinon';
import { MetadataType, VirtualDirectory } from '../../src';
import { ForceIgnore } from '../../src/resolve/forceIgnore';
import { SourceAdapterFactory } from '../../src/resolve/adapters/sourceAdapterFactory';
import { VirtualTreeContainer } from '../../src/resolve/treeContainers';
import { mockRegistry } from '../mock/registry';
import { MetadataResolver, SourceComponent } from '../../src/resolve';
import { SourcePath } from '../../src/common';

export class RegistryTestUtil {
  private env: SinonSandbox;

  constructor(env: SinonSandbox = createSandbox()) {
    this.env = env;
  }

  public restore(): void {
    this.env.restore();
  }

  public createMetadataResolver(virtualFS: VirtualDirectory[]): MetadataResolver {
    return new MetadataResolver(mockRegistry, new VirtualTreeContainer(virtualFS));
  }

  public stubAdapters(
    config: {
      type: MetadataType;
      componentMappings: { path: SourcePath; component: SourceComponent }[];
      allowContent?: boolean;
    }[]
  ): void {
    const getAdapterStub = this.env.stub(SourceAdapterFactory.prototype, 'getAdapter');
    for (const entry of config) {
      const componentMap: { [path: string]: SourceComponent } = {};
      for (const c of entry.componentMappings) {
        componentMap[c.path] = c.component;
      }
      getAdapterStub.withArgs(entry.type).returns({
        getComponent: (path: SourcePath) => componentMap[path],
        allowMetadataWithContent: () => entry.allowContent,
      });
    }
  }

  public stubForceIgnore(config: {
    seed: SourcePath;
    accept?: SourcePath[];
    deny?: SourcePath[];
  }): ForceIgnore {
    const forceIgnore = new ForceIgnore();
    const acceptStub = this.env.stub(forceIgnore, 'accepts');
    const denyStub = this.env.stub(forceIgnore, 'denies');
    if (config.deny) {
      config.deny.forEach((path) => {
        denyStub.withArgs(path).returns(true);
        acceptStub.withArgs(path).returns(false);
      });
    }
    if (config.accept) {
      config.accept.forEach((path) => {
        acceptStub.withArgs(path).returns(true);
        denyStub.withArgs(path).returns(false);
      });
    }
    const createIgnoreStub = this.env.stub(ForceIgnore, 'findAndCreate');
    createIgnoreStub.withArgs(config.seed).returns(forceIgnore);
    return forceIgnore;
  }
}
