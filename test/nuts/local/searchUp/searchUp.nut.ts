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

import * as path from 'node:path';
import * as fs from 'node:fs';
import { TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { searchUp } from '../../../../src/utils/fileSystemHandler';

describe('searchUp nut test', () => {
  let session: TestSession;

  before(async () => {
    session = await TestSession.create({
      project: {
        name: 'searchUpNut',
      },
      devhubAuthStrategy: 'NONE',
    });

    // Create directory structure:
    // tempDir/
    //   level1/
    //     level2/
    //       level3/
    //       startDir/
    //       target.txt (file to search for - in parent of startDir)
    //     anotherFile.txt
    //   .gitignore

    const level1Dir = path.join(session.project.dir, 'level1');
    const level2Dir = path.join(level1Dir, 'level2');
    const level3Dir = path.join(level2Dir, 'level3');
    const startDir = path.join(level2Dir, 'startDir');

    fs.mkdirSync(level3Dir, { recursive: true });
    fs.mkdirSync(startDir, { recursive: true });

    fs.writeFileSync(path.join(level2Dir, 'target.txt'), 'target file content');
    fs.writeFileSync(path.join(level1Dir, 'anotherFile.txt'), 'another file');
    fs.writeFileSync(path.join(session.project.dir, '.gitignore'), 'gitignore content');
  });

  after(async () => {
    await session?.clean();
  });

  describe('relative paths', () => {
    it('finds file in parent directory', () => {
      const relativeStartPath = path.relative(
        session.project.dir,
        path.join(session.project.dir, 'level1', 'level2', 'startDir')
      );
      expect(path.isAbsolute(relativeStartPath)).to.be.false;
      const result = searchUp(relativeStartPath, 'target.txt');
      const expected = path.relative(
        session.project.dir,
        path.join(session.project.dir, 'level1', 'level2', 'target.txt')
      );

      expect(result).to.equal(expected);
    });

    it('finds file multiple levels up', () => {
      const relativeStartPath = path.relative(
        session.project.dir,
        path.join(session.project.dir, 'level1', 'level2', 'startDir')
      );
      expect(path.isAbsolute(relativeStartPath)).to.be.false;
      const result = searchUp(relativeStartPath, '.gitignore');
      const expected = path.relative(session.project.dir, path.join(session.project.dir, '.gitignore'));

      expect(result).to.equal(expected);
    });

    it('finds file in current directory', () => {
      const relativeStartPath = path.relative(
        session.project.dir,
        path.join(session.project.dir, 'level1', 'level2', 'startDir')
      );
      expect(path.isAbsolute(relativeStartPath)).to.be.false;
      const absoluteStartPath = path.resolve(session.project.dir, relativeStartPath);
      fs.writeFileSync(path.join(absoluteStartPath, 'localFile.txt'), 'local content');
      const result = searchUp(relativeStartPath, 'localFile.txt');
      const expected = path.relative(session.project.dir, path.join(absoluteStartPath, 'localFile.txt'));

      expect(result).to.equal(expected);
    });

    it('returns undefined when file not found', () => {
      const relativeStartPath = path.relative(
        session.project.dir,
        path.join(session.project.dir, 'level1', 'level2', 'startDir')
      );
      expect(path.isAbsolute(relativeStartPath)).to.be.false;
      const result = searchUp(relativeStartPath, 'nonexistent.txt');

      expect(result).to.be.undefined;
    });

    it('works when starting from file path', () => {
      const relativeFilePath = path.relative(
        session.project.dir,
        path.join(session.project.dir, 'level1', 'level2', 'startDir', 'someFile.txt')
      );
      expect(path.isAbsolute(relativeFilePath)).to.be.false;
      const absoluteFilePath = path.resolve(session.project.dir, relativeFilePath);
      fs.writeFileSync(absoluteFilePath, 'content');
      const result = searchUp(relativeFilePath, 'target.txt');
      const expected = path.relative(
        session.project.dir,
        path.join(session.project.dir, 'level1', 'level2', 'target.txt')
      );

      expect(result).to.equal(expected);
    });
  });

  describe('absolute paths', () => {
    it('finds file in parent directory', () => {
      const startPath = path.resolve(session.project.dir, 'level1', 'level2', 'startDir');
      const result = searchUp(startPath, 'target.txt');
      const expected = path.resolve(session.project.dir, 'level1', 'level2', 'target.txt');

      expect(result).to.equal(expected);
    });

    it('finds file at root', () => {
      const startPath = path.resolve(session.project.dir, 'level1', 'level2', 'startDir');
      const result = searchUp(startPath, '.gitignore');
      const expected = path.resolve(session.project.dir, '.gitignore');

      expect(result).to.equal(expected);
    });

    it('finds file in current directory', () => {
      const startPath = path.resolve(session.project.dir, 'level1', 'level2', 'startDir');
      fs.writeFileSync(path.join(startPath, 'absoluteLocal.txt'), 'local content');
      const result = searchUp(startPath, 'absoluteLocal.txt');
      const expected = path.resolve(startPath, 'absoluteLocal.txt');

      expect(result).to.equal(expected);
    });

    it('returns undefined when file not found', () => {
      const startPath = path.resolve(session.project.dir, 'level1', 'level2', 'startDir');
      const result = searchUp(startPath, 'nonexistent.txt');

      expect(result).to.be.undefined;
    });

    it('works when starting from absolute file path', () => {
      const filePath = path.resolve(session.project.dir, 'level1', 'level2', 'startDir', 'someAbsoluteFile.txt');
      fs.writeFileSync(filePath, 'content');
      const result = searchUp(filePath, 'target.txt');
      const expected = path.resolve(session.project.dir, 'level1', 'level2', 'target.txt');

      expect(result).to.equal(expected);
    });

    it('stops at filesystem root when traversing up', () => {
      // Start from a deep absolute path and search for a file that doesn't exist
      // This should traverse up to the filesystem root and stop there (not try to go above root)
      const startPath = path.resolve(session.project.dir, 'level1', 'level2', 'startDir');
      const result = searchUp(startPath, 'definitelyDoesNotExist.txt');

      expect(result).to.be.undefined;
    });

    it('stops immediately when starting from filesystem root', () => {
      // Test that starting from root itself doesn't try to use .. logic
      // Find the root by resolving up until parent equals start
      let rootPath = path.resolve(session.project.dir);
      let parent = path.resolve(rootPath, '..');
      while (parent !== rootPath) {
        rootPath = parent;
        parent = path.resolve(rootPath, '..');
      }
      // Now rootPath is the filesystem root
      const result = searchUp(rootPath, 'someFileThatDoesNotExist.txt');
      expect(result).to.be.undefined;
    });
  });
});
