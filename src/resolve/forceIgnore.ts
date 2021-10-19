/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { dirname, join, relative } from 'path';
import ignore, { Ignore } from 'ignore/index';
import { readFileSync } from 'graceful-fs';
import { SourcePath } from '../common';
import { searchUp } from '../utils/fileSystemHandler';

export class ForceIgnore {
  public static readonly FILE_NAME = '.forceignore';

  private readonly parser: Ignore;
  private readonly forceIgnoreDirectory: string;
  private readonly contents?: string;
  private DEFAULT_IGNORE: string[] = [
    '**/*.dup',
    '**/.*',
    '**/package2-descriptor.json',
    '**/package2-manifest.json',
  ];

  public constructor(forceIgnorePath = '') {
    try {
      this.contents = readFileSync(forceIgnorePath, 'utf-8');
      // check if file `.forceignore` exists
      if (this.contents !== undefined) {
        // add the default ignore paths, and then parse the .forceignore file
        this.parser = ignore().add(`${this.contents}\n${this.DEFAULT_IGNORE.join('\n')}`);
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
    try {
      return this.parser.ignores(relative(this.forceIgnoreDirectory, fsPath));
    } catch (e) {
      return false;
    }
  }

  public accepts(fsPath: SourcePath): boolean {
    try {
      return !this.parser.ignores(relative(this.forceIgnoreDirectory, fsPath));
    } catch (e) {
      return true;
    }
  }
}
