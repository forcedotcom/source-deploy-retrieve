/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { VirtualDirectory, TreeContainer } from '.';
import { join, dirname, basename, normalize } from 'path';
import { baseName, parseMetadataXml } from '../utils';
import { lstatSync, existsSync, readdirSync, createReadStream, readFileSync } from 'fs';
import { LibraryError } from '../errors';
import { SourcePath } from '../common';
import * as unzipper from 'unzipper';
import { Readable } from 'stream';

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
  public abstract stream(fsPath: SourcePath): Readable;
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
    // significant performance increase using sync instead of fs.promise version
    return Promise.resolve(readFileSync(fsPath));
  }

  public stream(fsPath: SourcePath): Readable {
    return createReadStream(fsPath);
  }
}

interface ZipEntry {
  path: string;
  stream?: () => unzipper.Entry;
  buffer?: () => Promise<Buffer>;
}

export class ZipTreeContainer extends BaseTreeContainer {
  private tree = new Map<SourcePath, ZipEntry[] | ZipEntry>();

  private constructor(directory: unzipper.CentralDirectory) {
    super();
    this.populate(directory);
  }

  public static async create(buffer: Buffer): Promise<ZipTreeContainer> {
    const directory = await unzipper.Open.buffer(buffer);
    return new ZipTreeContainer(directory);
  }

  public exists(fsPath: string): boolean {
    return this.tree.has(fsPath);
  }

  public isDirectory(fsPath: string): boolean {
    if (this.exists(fsPath)) {
      return Array.isArray(this.tree.get(fsPath));
    }
    throw new LibraryError('error_path_not_found', fsPath);
  }

  public readDirectory(fsPath: string): string[] {
    if (this.isDirectory(fsPath)) {
      return (this.tree.get(fsPath) as ZipEntry[]).map((entry) => basename(entry.path));
    }
    throw new LibraryError('error_expected_directory_path', fsPath);
  }

  public readFile(fsPath: string): Promise<Buffer> {
    if (!this.isDirectory(fsPath)) {
      return (this.tree.get(fsPath) as ZipEntry).buffer();
    }
    throw new LibraryError('error_expected_file_path', fsPath);
  }

  public stream(fsPath: string): Readable {
    if (!this.isDirectory(fsPath)) {
      return (this.tree.get(fsPath) as ZipEntry).stream();
    }
    throw new LibraryError('error_no_directory_stream', this.constructor.name);
  }

  private populate(directory: unzipper.CentralDirectory): void {
    for (const { path, type, stream, buffer } of directory.files) {
      if (type === 'File') {
        // normalize path to use OS separator since zip entries always use forward slash
        const entry = { path: normalize(path), stream, buffer };
        this.tree.set(entry.path, entry);
        this.ensureDirPathExists(entry);
      }
    }
  }

  private ensureDirPathExists(entry: ZipEntry): void {
    const dirPath = dirname(entry.path);
    if (dirPath === entry.path) {
      return;
    } else if (!this.exists(dirPath)) {
      this.tree.set(dirPath, [entry]);
      this.ensureDirPathExists({ path: dirPath });
    } else {
      (this.tree.get(dirPath) as ZipEntry[]).push(entry);
    }
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
    if (this.isDirectory(fsPath)) {
      return Array.from(this.tree.get(fsPath)).map((p) => basename(p));
    }
    throw new LibraryError('error_expected_directory_path', fsPath);
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public stream(fsPath: string): Readable {
    throw new Error('Method not implemented');
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
