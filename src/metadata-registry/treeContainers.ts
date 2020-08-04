/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SourcePath, VirtualDirectory, TreeContainer } from '../types';
import { join, dirname, basename } from 'path';
import { baseName } from '../utils';
import { parseMetadataXml } from '../utils/registry';
import { lstatSync, existsSync, readdirSync, promises as fsPromises } from 'fs';
import { LibraryError } from '../errors';

/**
 * An extendable base class for implementing the `TreeContainer` interface
 */
export abstract class BaseTreeContainer implements TreeContainer {
  public find(
    fileType: 'content' | 'metadata',
    fullName: string,
    dir: SourcePath
  ): SourcePath | undefined {
    const fileName = this.readDirectory(dir).find((entry) => {
      const parsed = parseMetadataXml(join(dir, entry));
      const metaXmlCondition = fileType === 'metadata' ? !!parsed : !parsed;
      return baseName(entry) === fullName && metaXmlCondition;
    });
    if (fileName) {
      return join(dir, fileName);
    }
  }

  public abstract exists(fsPath: SourcePath): boolean;
  public abstract isDirectory(fsPath: SourcePath): boolean;
  public abstract readDirectory(fsPath: SourcePath): string[];
  public abstract readFile(fsPath: SourcePath): Promise<Buffer>;
}

export class NodeFSTreeContainer extends BaseTreeContainer {
  public isDirectory(fsPath: SourcePath): boolean {
    return lstatSync(fsPath).isDirectory();
  }

  public exists(fsPath: SourcePath): boolean {
    return existsSync(fsPath);
  }

  public readDirectory(fsPath: SourcePath): string[] {
    return readdirSync(fsPath);
  }

  public readFile(fsPath: SourcePath): Promise<Buffer> {
    return fsPromises.readFile(fsPath);
  }
}

export class VirtualTreeContainer extends BaseTreeContainer {
  private tree = new Map<SourcePath, Set<SourcePath>>();
  private fileContents = new Map<SourcePath, Buffer>();

  constructor(virtualFs: VirtualDirectory[]) {
    super();
    this.populate(virtualFs);
  }

  public isDirectory(fsPath: string): boolean {
    if (this.exists(fsPath)) {
      return this.tree.has(fsPath);
    }
    throw new LibraryError('error_path_not_found', fsPath);
  }

  public exists(fsPath: string): boolean {
    const files = this.tree.get(dirname(fsPath));
    const isFile = files && files.has(fsPath);
    return isFile || this.tree.has(fsPath);
  }

  public readDirectory(fsPath: string): string[] {
    return Array.from(this.tree.get(fsPath)).map((p) => basename(p));
  }

  public readFile(fsPath: SourcePath): Promise<Buffer> {
    if (this.exists(fsPath)) {
      let data = this.fileContents.get(fsPath);
      if (!data) {
        data = Buffer.from('');
        this.fileContents.set(fsPath, data);
      }
      return Promise.resolve(data);
    }
    throw new LibraryError('error_path_not_found', fsPath);
  }

  private populate(virtualFs: VirtualDirectory[]): void {
    for (const dir of virtualFs) {
      const { dirPath, children } = dir;
      this.tree.set(dirPath, new Set());
      for (const child of children) {
        let childPath: SourcePath;
        let childData: Buffer;
        if (typeof child === 'string') {
          childPath = join(dirPath, child);
        } else {
          childPath = join(dirPath, child.name);
          childData = child.data;
        }

        this.tree.get(dirPath).add(childPath);
        if (childData) {
          this.fileContents.set(childPath, childData);
        }
      }
    }
  }
}
