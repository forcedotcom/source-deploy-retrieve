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

import { dirname, join, relative } from 'node:path';
import * as os from 'node:os';
import ignore, { Ignore } from 'ignore/index';
import { readFileSync } from 'graceful-fs';
import { Lifecycle } from '@salesforce/core/lifecycle';
import { SourcePath } from '../common/types';
import { searchUp } from '../utils/fileSystemHandler';

export class ForceIgnore {
  public static readonly FILE_NAME = '.forceignore';

  private readonly parser?: Ignore;
  private readonly forceIgnoreDirectory?: string;
  private DEFAULT_IGNORE = ['**/*.dup', '**/.*', '**/package2-descriptor.json', '**/package2-manifest.json'];

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
   * @param seed Path to begin the `.forceignore` search from
   */
  public static findAndCreate(seed: SourcePath): ForceIgnore {
    const projectConfigPath = searchUp(seed, ForceIgnore.FILE_NAME);
    return new ForceIgnore(projectConfigPath ? join(dirname(projectConfigPath), ForceIgnore.FILE_NAME) : '');
  }

  public denies(fsPath: SourcePath): boolean {
    if (!this.parser || !this.forceIgnoreDirectory) return false;
    try {
      return this.parser.ignores(relative(this.forceIgnoreDirectory, fsPath));
    } catch (e) {
      return false;
    }
  }

  public accepts(fsPath: SourcePath): boolean {
    if (!this.parser || !this.forceIgnoreDirectory) return true;
    try {
      return !this.parser.ignores(relative(this.forceIgnoreDirectory, fsPath));
    } catch (e) {
      return true;
    }
  }
}
