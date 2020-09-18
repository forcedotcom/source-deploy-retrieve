/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import ignore, { Ignore } from 'ignore/index';
import { relative, join, dirname, sep } from 'path';
import { readFileSync } from 'fs';
import { FORCE_IGNORE_FILE } from '../utils/constants';
import { SourcePath } from '../common';
import { searchUp } from '../utils/fileSystemHandler';
// @ts-ignore this doesn't have typings
import * as gitignoreParser from 'gitignore-parser';
import { Lifecycle } from '@salesforce/core';

let warn = true;

export class ForceIgnore {
  private readonly parser: Ignore;
  private readonly forceIgnoreDirectory: string;
  // TODO: REMOVE THE BELOW CLASS MEMBERS
  private readonly gitignoreParser: gitignoreParser;
  private ignoreLines: string[] = [];
  private readonly contents?: string;
  private readonly useNewParser: boolean;
  private DEFAULT_IGNORE: string[] = [
    '**/*.dup',
    '**/.*',
    '**/package2-descriptor.json',
    '**/package2-manifest.json',
  ];
  public constructor(forceIgnorePath = '') {
    try {
      const file = readFileSync(forceIgnorePath, 'utf-8');
      this.contents = this.parseContents(`${file}\n${this.DEFAULT_IGNORE.join('\n')}`);
      // add the default ignore paths, and then parse the .forceignore file
      this.parser = ignore().add(this.contents.split('\n'));
      // TODO: START REMOVE AFTER GITIGNORE-PARSER DEPRECATED
      // add the default and send to the old gitignore-parser
      this.gitignoreParser = gitignoreParser.compile(this.contents);
      this.forceIgnoreDirectory = dirname(forceIgnorePath);

      // read the file to determine which parser to use
      this.useNewParser = this.contents.includes('# .forceignore v2');
      // END REMOVE
    } catch (e) {
      // TODO: log no force ignore
    }
  }

  // REMOVE THIS AFTER GITIGNORE-PARSER DEPRECATED
  private parseContents(contents: string): string {
    return contents
      .split('\n')
      .map((line) => line.trim())
      .map((line) => line.replace(/[\\\/]/g, sep))
      .map((line) => line.replace(/^\\/, ''))
      .join('\n');
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
    // AFTER GITIGNORE-PARSER DEPRECATED, change this to `return this.parser.ignores(relative(this.forceIgnoreDirectory, fsPath));`
    let denies = false;
    let fctResult = false;
    // if there's a parser, and we're not trying to .forceignore the .forceignore
    if (this.parser && this.gitignoreParser && !!relative(this.forceIgnoreDirectory, fsPath)) {
      denies = this.parser.ignores(relative(this.forceIgnoreDirectory, fsPath));
      fctResult = this.gitignoreParser.denies(relative(this.forceIgnoreDirectory, fsPath));
      // send to look for differences, analytics
      this.resolveConflict(denies, fctResult, this.contents);
    }
    return this.useNewParser ? denies : fctResult;
  }

  public accepts(fsPath: SourcePath): boolean {
    // AFTER GITIGNORE-PARSER DEPRECATED, change this to `return !this.parser.ignores(relative(this.forceIgnoreDirectory, fsPath));`
    let accepts = true;
    let fctResult = true;
    if (this.parser && this.gitignoreParser && !!relative(this.forceIgnoreDirectory, fsPath)) {
      accepts = !this.parser.ignores(relative(this.forceIgnoreDirectory, fsPath));
      fctResult = this.gitignoreParser.accepts(relative(this.forceIgnoreDirectory, fsPath));
      // send to look for differences, analytics
      this.resolveConflict(accepts, fctResult, this.contents);
    }

    return this.useNewParser ? accepts : fctResult;
  }

  // AFTER GITIGNORE-PARSER DEPRECATED, remove this method
  private resolveConflict(
    newLibraryResults: boolean,
    oldLibraryResults: boolean,
    file: string
  ): void {
    const ignoreItems = this.contents.split('\n');

    if (newLibraryResults !== oldLibraryResults && ignoreItems) {
      ignoreItems.forEach((ignoreItem) => {
        // we need to run the both of the compilers for a single line to find the problem entry
        const gitignoreResult = gitignoreParser
          .compile(ignoreItem)
          .accepts(relative(this.forceIgnoreDirectory, file));
        const ignoreResult = !ignore()
          .add([ignoreItem])
          .ignores(relative(this.forceIgnoreDirectory, file));
        // print the warning only once per forceignore line item
        if (ignoreResult !== gitignoreResult && !this.ignoreLines.includes(ignoreItem) && warn) {
          // only show the warning once, it could come from denies() or accepts()
          warn = false;
          process.emitWarning(
            "The .forceignore file doesn't adhere to .gitignore format which will be the default behavior starting in Spring '21 release. More information on .gitignore format here: https://git-scm.com/docs/gitignore. Fix the following lines in your .forceignore and add '# .forceignore v2' to your .forceignore file to switch to the new behavior."
          );
          process.emitWarning('\t' + ignoreItem);
        }
        this.ignoreLines.push(ignoreItem);
      });

      // send analytics, if they exist.
      Lifecycle.getInstance().emit('telemetry', {
        eventName: 'FORCE_IGNORE_DIFFERENCE',
        content: this.contents,
        oldLibraryResults,
        newLibraryResults,
        ignoreLines: this.ignoreLines,
        file,
      });
    }
  }
}
