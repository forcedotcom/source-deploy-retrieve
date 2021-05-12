/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import ignore, { Ignore } from 'ignore/index';
import { dirname, join, relative, sep } from 'path';
import { readFileSync } from 'fs';
import { SourcePath } from '../common';
import { searchUp } from '../utils/fileSystemHandler';
// @ts-ignore this doesn't have typings
import * as gitignoreParser from 'gitignore-parser';
import { Lifecycle } from '@salesforce/core';

let warn = true;

export class ForceIgnore {
  public static readonly FILE_NAME = '.forceignore';

  private readonly parser: Ignore;
  private readonly forceIgnoreDirectory: string;
  // TODO: REMOVE THE BELOW CLASS MEMBERS
  private readonly gitignoreParser: gitignoreParser;
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
      this.contents = readFileSync(forceIgnorePath, 'utf-8');
      // add the default ignore paths, and then parse the .forceignore file
      // DO NOT CALL parseContents FOR THE NEW PARSER
      // the new library handles it's own unix/windows file path separators, let it handle it
      this.parser = ignore().add(`${this.contents}\n${this.DEFAULT_IGNORE.join('\n')}`);
      // TODO: START REMOVE AFTER GITIGNORE-PARSER DEPRECATED
      // add the default and send to the old gitignore-parser
      this.gitignoreParser = gitignoreParser.compile(this.parseContents(this.contents));
      this.forceIgnoreDirectory = dirname(forceIgnorePath);

      // read the file to determine which parser to use
      this.useNewParser = this.contents.includes('# .forceignore v2');
      // END REMOVE
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
      // AFTER GITIGNORE-PARSER DEPRECATED, change this to `return this.parser.ignores(relative(this.forceIgnoreDirectory, fsPath));`
      let denies = false;
      let fctResult = false;
      // if there's a parser, and we're not trying to .forceignore the .forceignore
      const relativePath = relative(this.forceIgnoreDirectory, fsPath);
      if (this.parser && this.gitignoreParser && !!relativePath) {
        denies = this.parser.ignores(relativePath);
        fctResult = this.gitignoreParser.denies(relativePath);
        // send to look for differences, analytics
        this.resolveConflict(denies, fctResult, relativePath);
      }
      return this.useNewParser ? denies : fctResult;
    } catch (e) {
      return false;
    }
  }

  public accepts(fsPath: SourcePath): boolean {
    try {
      // AFTER GITIGNORE-PARSER DEPRECATED, change this to `return !this.parser.ignores(relative(this.forceIgnoreDirectory, fsPath));`
      let accepts = true;
      let fctResult = true;
      const relativePath = relative(this.forceIgnoreDirectory, fsPath);
      if (this.parser && this.gitignoreParser && !!relativePath) {
        accepts = !this.parser.ignores(relativePath);
        fctResult = this.gitignoreParser.accepts(relativePath);
        // send to look for differences, analytics
        this.resolveConflict(accepts, fctResult, relativePath);
      }

      return this.useNewParser ? accepts : fctResult;
    } catch (e) {
      return true;
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

  // AFTER GITIGNORE-PARSER DEPRECATED, remove this method
  private resolveConflict(
    newLibraryResults: boolean,
    oldLibraryResults: boolean,
    fsPath: string
  ): void {
    const ignoreItems = this.contents.split('\n');
    const troubledIgnoreLines: Set<string> = new Set<string>();

    if (newLibraryResults !== oldLibraryResults && ignoreItems) {
      ignoreItems.forEach((ignoreItem) => {
        // we need to run the both of the compilers for a single line to find the problem entry
        const gitignoreResult = gitignoreParser
          .compile(this.parseContents(ignoreItem))
          .accepts(fsPath);
        const ignoreResult = !ignore().add([ignoreItem]).ignores(fsPath);
        // print the warning only once per forceignore line item
        if (ignoreResult !== gitignoreResult && !troubledIgnoreLines.has(ignoreItem) && warn) {
          // only show the warning once, it could come from denies() or accepts()
          warn = false;
          process.emitWarning(
            "The .forceignore file doesn't adhere to .gitignore format which will be the default behavior starting in Spring '21 release. More information on .gitignore format here: https://git-scm.com/docs/gitignore. Fix the following lines in your .forceignore and add '# .forceignore v2' to your .forceignore file to switch to the new behavior."
          );
          process.emitWarning('\t' + ignoreItem);
        }
        troubledIgnoreLines.add(ignoreItem);
      });

      // send analytics, if they exist.
      Lifecycle.getInstance().emit('telemetry', {
        eventName: 'FORCE_IGNORE_DIFFERENCE',
        content: this.contents,
        oldLibraryResults,
        newLibraryResults,
        ignoreLines: Array.from(troubledIgnoreLines),
        file: fsPath,
      });
    }
  }
}
