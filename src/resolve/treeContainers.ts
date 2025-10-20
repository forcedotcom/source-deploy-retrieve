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
/* eslint-disable class-methods-use-this */
import { join, dirname, basename, sep, posix } from 'node:path';
import { Readable } from 'node:stream';
import { statSync, existsSync, readdirSync, createReadStream, readFileSync } from 'graceful-fs';
import JSZip from 'jszip';
import { Messages } from '@salesforce/core/messages';
import { SfError } from '@salesforce/core/sfError';
import { isString } from '@salesforce/ts-types';
import { baseName, parseMetadataXml } from '../utils/path';
import type { SourcePath } from '../common/types';
import { getStreamOptions } from '../convert/streams';
import type { VirtualDirectory } from './types';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

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
  public find(fileType: 'content' | 'metadataXml', name: string, directory: string): string | undefined {
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
    // use stat instead of lstat to follow symlinks
    return statSync(fsPath).isDirectory();
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
    if (!this.exists(fsPath)) {
      throw new Error(`File not found: ${fsPath}`);
    }
    return createReadStream(fsPath, getStreamOptions());
  }
}

/**
 * A {@link TreeContainer} that performs I/O without unzipping it to the disk first.
 */
export class ZipTreeContainer extends TreeContainer {
  private zip: JSZip;
  private zipKeyMap: Map<string, string> = new Map<string, string>();

  private constructor(zip: JSZip) {
    super();
    this.zip = zip;
    for (const key of Object.keys(this.zip.files)) {
      if (key.endsWith('/')) {
        this.zipKeyMap.set(key.slice(0, -1), key);
      } else {
        this.zipKeyMap.set(key, key);
      }
    }
  }

  public static async create(buffer: Buffer): Promise<ZipTreeContainer> {
    const zip = await JSZip.loadAsync(buffer, { createFolders: true });
    return new ZipTreeContainer(zip);
  }

  public exists(fsPath: string): boolean {
    return !!this.match(fsPath);
  }

  public isDirectory(fsPath: string): boolean {
    const resolvedPath = this.match(fsPath);
    if (resolvedPath) {
      return this.ensureDirectory(resolvedPath);
    }
    throw new SfError(messages.getMessage('error_path_not_found', [fsPath]), 'LibraryError');
  }

  public readDirectory(fsPath: string): string[] {
    const resolvedPath = this.match(fsPath);
    if (resolvedPath && this.ensureDirectory(resolvedPath)) {
      // Remove trailing path sep if it exists. JSZip always adds them for directories but
      // when comparing we call `dirname()` which does not include them.
      const dirPath = resolvedPath.endsWith('/') ? resolvedPath.slice(0, -1) : resolvedPath;
      return Object.keys(this.zip.files)
        .filter((filePath) => dirname(filePath) === dirPath)
        .map((filePath) => basename(filePath));
    }
    throw new SfError(messages.getMessage('error_expected_directory_path', [fsPath]), 'LibraryError');
  }

  public async readFile(fsPath: string): Promise<Buffer> {
    const resolvedPath = this.match(fsPath);
    if (resolvedPath) {
      const jsZipObj = this.zip.file(resolvedPath);
      if (jsZipObj?.dir === false) {
        return jsZipObj.async('nodebuffer');
      }
      throw new SfError(`Expected a file at path ${fsPath} but found a directory.`);
    }
    throw new SfError(messages.getMessage('error_expected_file_path', [fsPath]), 'LibraryError');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public readFileSync(fsPath: string): Buffer {
    throw new Error('Method not implemented');
  }

  public stream(fsPath: string): Readable {
    const resolvedPath = this.match(fsPath);
    if (resolvedPath) {
      const jsZipObj = this.zip.file(resolvedPath);
      if (jsZipObj && !jsZipObj.dir) {
        return new Readable(getStreamOptions()).wrap(jsZipObj.nodeStream());
      }
      throw new SfError(messages.getMessage('error_no_directory_stream', [this.constructor.name]), 'LibraryError');
    }
    throw new SfError(messages.getMessage('error_expected_file_path', [fsPath]), 'LibraryError');
  }

  // Finds a matching entry in the map of zip keys (that have trailing /'s removed).
  // Note that zip files always use forward slash separators, so the provided path
  // is converted to use posix forward slash separators before comparing.
  private match(fsPath: string): string | undefined {
    // "dot" has a special meaning as a directory name and always matches. Just return it.
    if (fsPath === '.') {
      return fsPath;
    }
    return this.zipKeyMap.get(posix.normalize(fsPath.replaceAll('\\', '/')));
  }

  private ensureDirectory(dirPath: string): boolean {
    if (dirPath) {
      // JSZip can have directory entries or only file entries (with virtual directory entries)
      const zipObj = this.zip.file(dirPath);
      return zipObj?.dir === true || !zipObj;
    }
    throw new SfError(messages.getMessage('error_path_not_found', [dirPath]), 'LibraryError');
  }
}

/**
 * A {@link TreeContainer} useful for mocking a file system.
 */
export class VirtualTreeContainer extends TreeContainer {
  private tree = new Map<SourcePath, Set<SourcePath>>();
  private fileContents = new Map<SourcePath, Buffer>();

  public constructor(virtualFs: VirtualDirectory[]) {
    super();
    this.populate(virtualFs);
  }

  /**
   * Designed for recreating virtual files from deleted files where the only information we have is the file's former location
   * Any use of MetadataResolver was trying to access the non-existent files and throwing
   *
   * @param paths full paths to files
   * @returns VirtualTreeContainer
   */
  public static fromFilePaths(paths: string[]): VirtualTreeContainer {
    // a map to reduce array iterations
    const virtualDirectoryByFullPath = new Map<string, VirtualDirectory>();
    paths
      // defending against undefined being passed in.  The metadata API sometimes responds missing fileName
      .filter(isString)
      .map((filename) => {
        const splits = filename.split(sep);
        for (let i = 0; i < splits.length - 1; i++) {
          const fullPathSoFar = splits.slice(0, i + 1).join(sep);
          const existing = virtualDirectoryByFullPath.get(fullPathSoFar);
          virtualDirectoryByFullPath.set(fullPathSoFar, {
            dirPath: fullPathSoFar,
            // only add to children if we don't already have it
            children: Array.from(new Set(existing?.children ?? []).add(splits[i + 1])),
          });
        }
      });
    return new VirtualTreeContainer(Array.from(virtualDirectoryByFullPath.values()));
  }

  public isDirectory(fsPath: string): boolean {
    if (this.exists(fsPath)) {
      return this.tree.has(fsPath);
    }
    throw new SfError(messages.getMessage('error_path_not_found', [fsPath]), 'LibraryError');
  }

  public exists(fsPath: string): boolean {
    const files = this.tree.get(dirname(fsPath));
    const isFile = files?.has(fsPath);
    return this.tree.has(fsPath) || Boolean(isFile);
  }

  public readDirectory(fsPath: string): string[] {
    if (this.isDirectory(fsPath)) {
      return Array.from(this.tree.get(fsPath) ?? []).map((p) => basename(p));
    }
    throw new SfError(messages.getMessage('error_expected_directory_path', [fsPath]), 'LibraryError');
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
    throw new SfError(messages.getMessage('error_path_not_found', [fsPath]), 'LibraryError');
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
        const childPath = isString(child) ? join(dirPath, child) : join(dirPath, child.name);

        const dirPathFromTree = this.tree.get(dirPath);
        if (!dirPathFromTree) {
          throw new SfError(`The directory at path ${dirPath} does not exist in the virtual file system.`);
        }
        dirPathFromTree.add(childPath);

        if (typeof child === 'object' && child.data) {
          this.fileContents.set(childPath, child.data);
        }
      }
    }
  }
}
