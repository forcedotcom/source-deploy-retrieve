/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createSandbox, SinonSandbox, SinonStub } from 'sinon';
import { SourcePath, MetadataType, MetadataComponent } from '../../src/types';
import * as fs from 'fs';
import * as fsUtil from '../../src/utils/fileSystemHandler';
import * as adapters from '../../src/metadata-registry/adapters';
import { join } from 'path';
import { ForceIgnore } from '../../src/metadata-registry/forceIgnore';
import { mockRegistry } from '../mock/registry';

export class RegistryTestUtil {
  private env: SinonSandbox;
  private existsStub: SinonStub;
  private isDirectoryStub: SinonStub;

  constructor(env: SinonSandbox = createSandbox()) {
    this.env = env;
  }

  public initStubs(): void {
    this.existsStub = this.env.stub(fs, 'existsSync');
    this.isDirectoryStub = this.env.stub(fsUtil, 'isDirectory');
    this.isDirectoryStub.returns(false);
  }

  public restore(): void {
    this.env.restore();
  }

  public exists(fsPath: SourcePath, exists: boolean): void {
    this.existsStub.withArgs(fsPath).returns(exists);
  }

  public stubDirectories(structure: { directory: SourcePath; fileNames: SourcePath[] }[]): void {
    const readDirStub: SinonStub = this.env.stub(fs, 'readdirSync');

    for (const part of structure) {
      this.existsStub.withArgs(part.directory).returns(true);
      this.isDirectoryStub.withArgs(part.directory).returns(true);
      for (const name of part.fileNames) {
        const fullPath = join(part.directory, name);
        this.existsStub.withArgs(fullPath).returns(true);
      }
      readDirStub.withArgs(part.directory).returns(part.fileNames);
    }
  }

  public stubAdapters(
    config: {
      type: MetadataType;
      componentMappings: { path: SourcePath; component: MetadataComponent }[];
    }[]
  ): void {
    const getAdapterStub = this.env.stub(adapters, 'getAdapter');
    for (const entry of config) {
      // @ts-ignore
      const adapterId = mockRegistry.adapters[entry.type.name.toLowerCase()];
      const componentMap: { [path: string]: MetadataComponent } = {};
      for (const c of entry.componentMappings) {
        componentMap[c.path] = c.component;
      }
      getAdapterStub.withArgs(entry.type, adapterId).returns({
        getComponent: (path: SourcePath) => componentMap[path]
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
      config.deny.forEach(path => {
        denyStub.withArgs(path).returns(true);
        acceptStub.withArgs(path).returns(false);
      });
    }
    if (config.accept) {
      config.accept.forEach(path => {
        acceptStub.withArgs(path).returns(true);
        denyStub.withArgs(path).returns(false);
      });
    }
    const createIgnoreStub = this.env.stub(ForceIgnore, 'findAndCreate');
    createIgnoreStub.withArgs(config.seed).returns(forceIgnore);
    return forceIgnore;
  }
}
