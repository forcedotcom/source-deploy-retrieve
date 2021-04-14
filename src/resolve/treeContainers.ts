/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join, dirname, basename, normalize } from 'path';
import { baseName, parseMetadataXml } from '../utils';
import { lstatSync, existsSync, readdirSync, createReadStream, readFileSync } from 'fs';
import { LibraryError } from '../errors';
import { SourcePath } from '../common';
import * as unzipper from 'unzipper';
import { Readable } from 'stream';
import { VirtualDirectory } from './types';

/**
 * A container for interacting with a file system. Operations such as component resolution,
 * conversion, and packaging perform I/O against `TreeContainer` abstractions.
 *
 * Extend this base class to implement a custom container.
 */
export abstract class TreeContainer {
  /**
   * Searches for a metadata component file in a container directory.
   *
   * @param fileType - The type of component file
   * @param name - The name of the file without a suffix
   * @param directory - The directory to search in
   * @returns The first path that meets the criteria, or `undefined` if none were found
   */
  public find(
    fileType: 'content' | 'metadataXml',
    name: string,
    directory: string
  ): string | undefined {
    const fileName = this.readDirectory(directory).find((entry) => {
      const parsed = parseMetadataXml(join(directory, entry));
      const metaXmlCondition = fileType === 'metadataXml' ? !!parsed : !parsed;
      return baseName(entry) === name && metaXmlCondition;
    });
    if (fileName) {
      return join(directory, fileName);
    }
  }
  /**
   * Whether or not a file path exists in the container.
   *
   * @param fsPath - File path to test
   * @returns `true` if the path exists
   */
  public abstract exists(fsPath: SourcePath): boolean;
  /**
   * Whether or not a file path is a directory in the container.
   *
   * @param fsPath - File path to test
   * @returns `true` if the path is to a directory
   */
  public abstract isDirectory(fsPath: SourcePath): boolean;
  /**
   * Reads the contents of a directory in the container.
   *
   * @param fsPath Path to directory
   * @returns An array of file and directory names in the directory
   */
  public abstract readDirectory(fsPath: SourcePath): string[];
  /**
   * Reads the contents of a file.
   *
   * @param fsPath
   * @returns A buffer of the file contents
   */
  public abstract readFile(fsPath: SourcePath): Promise<Buffer>;
  /**
   * Reads the contents of a file synchronously.
   *
   * @param fsPath
   * @returns A buffer of the file contents
   */
  public abstract readFileSync(fsPath: SourcePath): Buffer;
  /**
   * Creates a readable stream of a file's contents.
   *
   * @param fsPath - File path to create a readable stream from
   * @returns A readable stream
   */
  public abstract stream(fsPath: SourcePath): Readable;
}

/**
 * A {@link TreeContainer} that wraps the NodeJS `fs` module.
 */
export class NodeFSTreeContainer extends TreeContainer {
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
    // significant enough performance increase using sync instead of fs.promise version
    return Promise.resolve(readFileSync(fsPath));
  }

  public readFileSync(fsPath: SourcePath): Buffer {
    return readFileSync(fsPath);
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

/**
 * A {@link TreeContainer} that utilizes the central directory of a zip file
 * to perform I/O without unzipping it to the disk first.
 */
export class ZipTreeContainer extends TreeContainer {
  private tree = new Map<SourcePath, ZipEntry[] | ZipEntry>();

  private constructor(directory: unzipper.CentralDirectory) {
    super();
    this.populate(directory);
  }

  /**
   * Creates a `ZipTreeContainer` from a Buffer of a zip file.
   *
   * @param buffer - Buffer of the zip file
   * @returns A Promise of a `ZipTreeContainer`
   */
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public readFileSync(fsPath: string): Buffer {
    throw new Error('Method not implemented');
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

/**
 * A {@link TreeContainer} useful for mocking a file system.
 */
export class VirtualTreeContainer extends TreeContainer {
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
    return Promise.resolve(this.readFileSync(fsPath));
  }

  public readFileSync(fsPath: SourcePath): Buffer {
    if (this.exists(fsPath)) {
      let data = this.fileContents.get(fsPath);
      if (!data) {
        data = Buffer.from('');
        this.fileContents.set(fsPath, data);
      }
      return data;
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
