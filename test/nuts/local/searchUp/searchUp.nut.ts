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
      const startPath = path.join(session.project.dir, 'level1', 'level2', 'startDir');
      const result = searchUp(startPath, 'target.txt');
      const expected = path.join(session.project.dir, 'level1', 'level2', 'target.txt');

      expect(result).to.equal(expected);
    });

    it('finds file multiple levels up', () => {
      const startPath = path.join(session.project.dir, 'level1', 'level2', 'startDir');
      const result = searchUp(startPath, '.gitignore');
      const expected = path.join(session.project.dir, '.gitignore');

      expect(result).to.equal(expected);
    });

    it('finds file in current directory', () => {
      const startPath = path.join(session.project.dir, 'level1', 'level2', 'startDir');
      fs.writeFileSync(path.join(startPath, 'localFile.txt'), 'local content');
      const result = searchUp(startPath, 'localFile.txt');
      const expected = path.join(startPath, 'localFile.txt');

      expect(result).to.equal(expected);
    });

    it('returns undefined when file not found', () => {
      const startPath = path.join(session.project.dir, 'level1', 'level2', 'startDir');
      const result = searchUp(startPath, 'nonexistent.txt');

      expect(result).to.be.undefined;
    });

    it('works when starting from file path', () => {
      const filePath = path.join(session.project.dir, 'level1', 'level2', 'startDir', 'someFile.txt');
      fs.writeFileSync(filePath, 'content');
      const result = searchUp(filePath, 'target.txt');
      const expected = path.join(session.project.dir, 'level1', 'level2', 'target.txt');

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
  });
});
