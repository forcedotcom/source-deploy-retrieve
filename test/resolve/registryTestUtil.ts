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
