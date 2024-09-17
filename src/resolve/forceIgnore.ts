/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { dirname, join, relative } from 'node:path';
import ignore, { Ignore } from 'ignore/index';
import { readFileSync } from 'graceful-fs';
import { Lifecycle, Logger } from '@salesforce/core';
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
        // check for windows style separators (\) and warn
        if (contents.includes('\\')) {
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
      Logger.childFromRoot(this.constructor.name).info('no .forceignore found');
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
    let potentialForceIgnorePath = '';
    const projectConfigPath = searchUp(seed, ForceIgnore.FILE_NAME);
    if (projectConfigPath) {
      potentialForceIgnorePath = join(dirname(projectConfigPath), ForceIgnore.FILE_NAME);
    }
    return new ForceIgnore(potentialForceIgnorePath);
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
