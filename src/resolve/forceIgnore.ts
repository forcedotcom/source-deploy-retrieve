/*
 * Copyright 2026, Salesforce, Inc.
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

import { dirname, isAbsolute, join, normalize, relative, resolve } from 'node:path';
import * as os from 'node:os';
import ignore, { Ignore } from 'ignore/index';
import { readFileSync, statSync } from 'graceful-fs';
import { Lifecycle } from '@salesforce/core/lifecycle';
import { Logger } from '@salesforce/core/logger';
import { SourcePath } from '../common/types';
import { searchUp } from '../utils/fileSystemHandler';

type FindCacheEntry = { mtimeMs: number; size: number; instance: ForceIgnore };

export class ForceIgnore {
  public static readonly FILE_NAME = '.forceignore';

  private static readonly findCache = new Map<string, FindCacheEntry>();
  private static emptySingleton: ForceIgnore | undefined;

  private readonly parser?: Ignore;
  private readonly forceIgnoreDirectory?: string;
  private DEFAULT_IGNORE = [
    '**/*.dup',
    // I know it's ugly.  But I want to be able to retrieve metadata to a local dir, segregated by org.
    // and `.sf` is already ignored in projects, and we already have orgIds for STL
    // so this nastiness is "ignore all dot files except this one directory"
    // once you ignore a parent ex `**/.*` you can't unignore something inside that path, at least with the curent ignore library
    '**/.*',
    '!.sf',
    '**/.sf/**',
    '!**/.sf/orgs',
    '!**/.sf/orgs/**',
    '**/.sf/orgs/*/**',
    '!**/.sf/orgs/*/remoteMetadata',
    '!**/.sf/orgs/*/remoteMetadata/**',
    '**/package2-descriptor.json',
    '**/package2-manifest.json',
  ];

  public constructor(forceIgnorePath = '') {
    try {
      const contents = readFileSync(forceIgnorePath, 'utf-8');
      // check if file `.forceignore` exists
      if (contents !== undefined) {
        // check for windows style separators (\) and warn, that aren't comments
        if (contents.split(os.EOL).find((c) => c.includes('\\') && !c.startsWith('#'))) {
          // void because you cannot await a method in a constructor
          void Lifecycle.getInstance().emitWarning(
            'Your .forceignore file incorrectly uses the backslash ("\\") as a folder separator; it should use the slash ("/") instead. The ignore rules will not work as expected until you fix this.'
          );
        }
        if (contents.includes('**/unpackaged/**')) {
          void Lifecycle.getInstance().emitWarning(
            'Your .forceignore file contains the "**/unpackaged/**" rule. This will cause all files to be ignored during a retrieve.'
          );
        }
        // add the default ignore paths, and then parse the .forceignore file
        this.parser = ignore().add(`${this.DEFAULT_IGNORE.join('\n')}\n${contents}`);

        this.forceIgnoreDirectory = dirname(forceIgnorePath);
      }
    } catch (e) {
      // TODO: log no force ignore
    }
  }

  /**
   * Performs an upward directory search for a `.forceignore` file and returns a
   * `ForceIgnore` object based on the result. If there is no `.forceignore` file,
   * the returned `ForceIgnore` object will accept everything.
   *
   * Parsed files are cached by absolute path and invalidated when `mtime` or `size` changes on disk.
   *
   * @param seed Path to begin the `.forceignore` search from
   */
  public static findAndCreate(seed: SourcePath): ForceIgnore {
    const projectConfigPath = searchUp(seed, ForceIgnore.FILE_NAME);
    if (!projectConfigPath) {
      ForceIgnore.emptySingleton ??= new ForceIgnore('');
      return ForceIgnore.emptySingleton;
    }

    const absPath = normalize(projectConfigPath);
    let mtimeMs: number;
    let size: number;
    try {
      const st = statSync(absPath);
      ({ mtimeMs, size } = st);
    } catch {
      return new ForceIgnore('');
    }

    const hit = ForceIgnore.findCache.get(absPath);
    if (hit && hit.mtimeMs === mtimeMs && hit.size === size) {
      return hit.instance;
    }

    const instance = new ForceIgnore(join(dirname(absPath), ForceIgnore.FILE_NAME));
    ForceIgnore.findCache.set(absPath, { mtimeMs, size, instance });
    return instance;
  }

  /** @internal clears module cache; for unit tests only */
  public static clearCacheForTest(): void {
    ForceIgnore.findCache.clear();
    ForceIgnore.emptySingleton = undefined;
  }

  public denies(fsPath: SourcePath): boolean {
    if (!this.parser || !this.forceIgnoreDirectory) return false;
    try {
      const absoluteFsPath = isAbsolute(fsPath) ? fsPath : resolve(this.forceIgnoreDirectory, fsPath);
      const relativePath = relative(this.forceIgnoreDirectory, absoluteFsPath);
      // Test both the plain path and the path with a trailing slash. The trailing-slash form
      // is required for node-ignore to match directory-only patterns like `node_modules/`.
      // Testing both means we correctly deny directories in virtual trees (e.g. ZipTreeContainer)
      // where statSync is unavailable, without requiring callers to signal directory-ness.
      const res = this.parser.ignores(relativePath) || this.parser.ignores(`${relativePath}/`);
      if (res) {
        Logger.childFromRoot('forceIgnore.denies').debug(
          `Ignoring '${fsPath}' because it matched .forceignore patterns.`
        );
      }
      return res;
    } catch (e) {
      return false;
    }
  }

  public accepts(fsPath: SourcePath): boolean {
    return !this.denies(fsPath);
  }
}
