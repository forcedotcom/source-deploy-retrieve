/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
//@ts-ignore
import * as gitignore from 'gitignore-parser';
import { sep, relative, join, dirname, basename } from 'path';
import { readFileSync } from 'fs';
import { FORCE_IGNORE_FILE } from '../utils/constants';
import { SourcePath } from '../types';
import { searchUp } from '../utils/fileSystemHandler';

export class ForceIgnore {
  /* eslint-disable-next-line  @typescript-eslint/no-explicit-any */
  private parser: any;
  private forceIgnoreDirectory: string;

  constructor(forceIgnorePath = '') {
    try {
      const forceIgnoreContents = this.parseContents(readFileSync(forceIgnorePath, 'utf8'));
      this.parser = gitignore.compile(forceIgnoreContents);
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
      denies = this.parser.denies(relative(this.forceIgnoreDirectory, fsPath));
    }
    return denies || !this.isValidAgainstDefaults(fsPath);
  }

  public accepts(fsPath: SourcePath): boolean {
    let accepts = true;
    if (this.parser) {
      accepts = this.parser.accepts(relative(this.forceIgnoreDirectory, fsPath));
    }
    return accepts && this.isValidAgainstDefaults(fsPath);
  }

  /**
   * This is not how we should ultimately test a path against default ignores.
   * TODO: When we utilize a new matching module this should be replaced.
   */
  private isValidAgainstDefaults(fsPath: SourcePath): boolean {
    const name = basename(fsPath);
    return (
      !name.startsWith('.') &&
      !name.endsWith('.dup') &&
      name !== 'package2-descriptor.json' &&
      name !== 'package2-manifest.json'
    );
  }

  private parseContents(contents: string): string {
    return contents
      .split('\n')
      .map((line) => line.trim())
      .map((line) => line.replace(/[\\\/]/g, sep))
      .map((line) => line.replace(/^\\/, ''))
      .join('\n');
  }
}
