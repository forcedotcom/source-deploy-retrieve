/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { createSandbox, SinonSandbox } from 'sinon';
import {
  ForceIgnore,
  MetadataResolver,
  MetadataType,
  SourceComponent,
  SourcePath,
  VirtualDirectory,
  VirtualTreeContainer,
} from '../../src';
import { SourceAdapterFactory } from '../../src/resolve/adapters/sourceAdapterFactory';

export class RegistryTestUtil {
  private env: SinonSandbox;

  public constructor(env: SinonSandbox = createSandbox()) {
    this.env = env;
  }

  public restore(): void {
    this.env.restore();
  }

  // excluded from rules because it's exposed publicly
  // eslint-disable-next-line class-methods-use-this
  public createMetadataResolver(virtualFS: VirtualDirectory[], useRealForceIgnore = true): MetadataResolver {
    return new MetadataResolver(undefined, new VirtualTreeContainer(virtualFS), useRealForceIgnore);
  }

  public stubAdapters(
    config: Array<{
      type: MetadataType;
      componentMappings: Array<{ path: SourcePath; component: SourceComponent }>;
      allowContent?: boolean;
    }>
  ): void {
    const getAdapterStub = this.env.stub(SourceAdapterFactory.prototype, 'getAdapter');
    for (const entry of config) {
      const componentMap: { [path: string]: SourceComponent } = {};
      for (const c of entry.componentMappings) {
        componentMap[c.path] = c.component;
      }
      getAdapterStub.withArgs(entry.type).returns({
        getComponent: (path: SourcePath) => componentMap[path],
        allowMetadataWithContent: () => entry.allowContent ?? false,
      });
    }
  }

  public stubForceIgnore(config: { seed: SourcePath; accept?: SourcePath[]; deny?: SourcePath[] }): ForceIgnore {
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
