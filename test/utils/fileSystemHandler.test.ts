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
import { join } from 'node:path';
import { SinonStub, createSandbox } from 'sinon';
import { expect, config } from 'chai';
import fs from 'graceful-fs';
import { searchUp } from '../../src/utils/fileSystemHandler';

const env = createSandbox();
config.truncateThreshold = 0;
describe('File System Utils', () => {
  const root = join(process.cwd(), 'path', 'to', 'whatever');

  afterEach(() => env.restore());

  describe('searchUp', () => {
    let existsStub: SinonStub;
    const filename = 'test.x';
    const filePath = join(root, filename);
    const startPath = join(root, 'a', 'more', 'nested', 'file.y');

    beforeEach(() => {
      existsStub = env.stub(fs, 'existsSync');
      existsStub.returns(false);
    });

    it('should traverse up and find a file with the given file name', () => {
      existsStub.withArgs(filePath).returns(true);
      expect(searchUp(startPath, filename)).to.equal(filePath);
    });

    it('should return start path if it is the file being searched for', () => {
      existsStub.withArgs(filePath).returns(true);
      expect(searchUp(filePath, filename)).to.equal(filePath);
    });

    it('should return undefined if file not found', () => {
      expect(searchUp(startPath, 'asdf')).to.be.undefined;
    });
  });
});
