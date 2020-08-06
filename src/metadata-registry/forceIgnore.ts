/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import ignore, { Ignore } from 'ignore/index';
import { relative, join, dirname, basename } from 'path';
import { readFileSync } from 'fs';
import { FORCE_IGNORE_FILE } from '../utils/constants';
import { SourcePath } from '../types';
import { searchUp } from '../utils/fileSystemHandler';

const DEFAULT_IGNORE: string[] = [
  '**/*.dup',
  '.*',
  'package2-descriptor.json',
  'package2-manifest.json',
];

export class ForceIgnore {
  private readonly parser: Ignore;
  private readonly forceIgnoreDirectory: string;

  constructor(forceIgnorePath = '') {
    try {
      // add the default ignore paths, and then parse the .forceignore file
      this.parser = ignore().add(DEFAULT_IGNORE).add(readFileSync(forceIgnorePath, 'utf-8'));
      this.forceIgnoreDirectory = dirname(forceIgnorePath);
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
    const projectConfigPath = searchUp(seed, FORCE_IGNORE_FILE);
    if (projectConfigPath) {
      potentialForceIgnorePath = join(dirname(projectConfigPath), FORCE_IGNORE_FILE);
    }
    return new ForceIgnore(potentialForceIgnorePath);
  }

  public denies(fsPath: SourcePath): boolean {
    let denies = false;
    if (this.parser) {
      denies = this.parser.ignores(relative(this.forceIgnoreDirectory, fsPath));
    }
    return denies;
  }

  public accepts(fsPath: SourcePath): boolean {
    let accepts = true;
    if (this.parser) {
      accepts = !this.parser.ignores(relative(this.forceIgnoreDirectory, fsPath));
    }
    return accepts;
  }
}
