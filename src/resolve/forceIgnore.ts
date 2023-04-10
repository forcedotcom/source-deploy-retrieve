/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { dirname, join, relative } from 'path';
import ignore, { Ignore } from 'ignore/index';
import { readFileSync } from 'graceful-fs';
import { Lifecycle } from '@salesforce/core';
import { SourcePath } from '../common';
import { searchUp } from '../utils/fileSystemHandler';

export class ForceIgnore {
  public static readonly FILE_NAME = '.forceignore';

  private readonly parser?: Ignore;
  private readonly forceIgnoreDirectory?: string;
  private DEFAULT_IGNORE: string[] = ['**/*.dup', '**/.*', '**/package2-descriptor.json', '**/package2-manifest.json'];

  public constructor(forceIgnorePath = '') {
    try {
      let contents = readFileSync(forceIgnorePath, 'utf-8');
      // check if file `.forceignore` exists
      if (contents !== undefined) {
        // check for windows style separators (\) and warn
        if (contents.includes('\\')) {
          const lifecycle = Lifecycle.getInstance();
          // cannot await a method in a constructor
          void lifecycle.emitWarning(
            'Your .forceignore file incorrectly uses the backslash ("\\") as a folder separator; it should use the slash ("/") instead. We currently accept both separators, but we plan to stop supporting the backslash soon.'
          );
          // TODO: change this in v56 to only emit warning but NOT fix file
          contents = contents.replace(/\\/g, '/');
        }

        // add the default ignore paths, and then parse the .forceignore file
        this.parser = ignore().add(`${contents}\n${this.DEFAULT_IGNORE.join('\n')}`);
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
