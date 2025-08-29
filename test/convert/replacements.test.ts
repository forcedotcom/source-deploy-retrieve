/*
 * Copyright 2025, Salesforce, Inc.
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
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { assert, expect, config } from 'chai';
import * as Sinon from 'sinon';
import { Lifecycle } from '@salesforce/core';
import {
  getReplacements,
  matchesFile,
  replacementIterations,
  stringToRegex,
  posixifyPaths,
  envFilter,
} from '../../src/convert/replacements';
import { matchingContentFile } from '../mock';
import * as replacementsForMock from '../../src/convert/replacements';
const { ReplacementStream } = replacementsForMock;

config.truncateThreshold = 0;

describe('file matching', () => {
  const base = { replaceWithEnv: 'foo', stringToReplace: 'foo' };
  it('file matches string', () => {
    expect(matchesFile('foo')({ filename: 'foo', ...base })).to.be.true;
    expect(matchesFile('bar')({ filename: 'foo', ...base })).to.not.be.true;
  });
  it('paths with separators to cover possibility of windows paths', () => {
    const fn = matchesFile(path.join('foo', 'bar'));
    expect(fn({ filename: 'foo/bar', ...base })).to.be.true;
    expect(fn({ filename: 'foo/baz', ...base })).to.not.be.true;
  });
  it('file matches glob (posix paths)', () => {
    const fn = matchesFile(path.join('foo', 'bar'));

    expect(fn({ glob: 'foo/**', ...base })).to.be.true;
    expect(fn({ glob: 'foo/*', ...base })).to.be.true;
    expect(fn({ glob: 'foo', ...base })).to.be.false;
    expect(fn({ glob: '**/*', ...base })).to.be.true;
  });
  it('file matches glob (os-dependent paths)', () => {
    const fn = matchesFile(path.join('foo', 'bar'));
    expect(fn({ glob: 'foo/**', ...base })).to.be.true;
    expect(fn({ glob: 'foo/*', ...base })).to.be.true;
    expect(fn({ glob: 'foo', ...base })).to.be.false;
    expect(fn({ glob: '**/*', ...base })).to.be.true;
  });
  it('test absolute vs. relative paths', () => {
    const fn = matchesFile(path.join('/Usr', 'me', 'foo', 'bar'));
    expect(fn({ glob: 'foo/**', ...base })).to.be.true;
    expect(fn({ glob: 'foo/*', ...base })).to.be.true;
    expect(fn({ glob: 'foo', ...base })).to.be.false;
    expect(fn({ glob: '**/*', ...base })).to.be.true;
  });
});

describe('env filters', () => {
  beforeEach(() => {
    process.env.SHOULD_REPLACE_FOO = undefined;
  });
  it('true when not replaceWhenEnv', () => {
    expect(envFilter({ stringToReplace: 'foo', filename: '*', replaceWithFile: '/some/file' })).to.equal(true);
  });
  it('true when env is set and value matches string', () => {
    process.env.SHOULD_REPLACE_FOO = 'x';
    expect(
      envFilter({
        stringToReplace: 'foo',
        filename: '*',
        replaceWithFile: '/some/file',
        replaceWhenEnv: [{ env: 'SHOULD_REPLACE_FOO', value: 'x' }],
      })
    ).to.equal(true);
  });
  it('true when env is set and value matches boolean', () => {
    process.env.SHOULD_REPLACE_FOO = 'true';
    expect(
      envFilter({
        stringToReplace: 'foo',
        filename: '*',
        replaceWithFile: '/some/file',
        replaceWhenEnv: [{ env: 'SHOULD_REPLACE_FOO', value: true }],
      })
    ).to.equal(true);
  });
  it('true when env is set and value matches number', () => {
    process.env.SHOULD_REPLACE_FOO = '6';
    expect(
      envFilter({
        stringToReplace: 'foo',
        filename: '*',
        replaceWithFile: '/some/file',
        replaceWhenEnv: [{ env: 'SHOULD_REPLACE_FOO', value: 6 }],
      })
    ).to.equal(true);
  });
  it('false when env is set and does not match number', () => {
    process.env.SHOULD_REPLACE_FOO = '6';
    expect(
      envFilter({
        stringToReplace: 'foo',
        filename: '*',
        replaceWithFile: '/some/file',
        replaceWhenEnv: [{ env: 'SHOULD_REPLACE_FOO', value: 7 }],
      })
    ).to.equal(false);
  });
  it('false when env is set and does not match string', () => {
    process.env.SHOULD_REPLACE_FOO = 'x';
    expect(
      envFilter({
        stringToReplace: 'foo',
        filename: '*',
        replaceWithFile: '/some/file',
        replaceWhenEnv: [{ env: 'SHOULD_REPLACE_FOO', value: 'y' }],
      })
    ).to.equal(false);
  });
  it('false when env is not set', () => {
    expect(
      envFilter({
        stringToReplace: 'foo',
        filename: '*',
        replaceWithFile: '/some/file',
        replaceWhenEnv: [{ env: 'SHOULD_REPLACE_FOO', value: 'true' }],
      })
    ).to.equal(false);
  });
});

describe('marking replacements on a component', () => {
  before(() => {
    // replaceFromFile uses the contents of a file.  This prevents the test from hitting real FS for that.
    Sinon.stub(replacementsForMock, 'getContentsOfReplacementFile').resolves('bar');
  });

  after(() => {
    Sinon.restore();
  });

  process.env.FOO_REPLACEMENT = 'bar';
  const cmp = matchingContentFile.COMPONENT;

  beforeEach(() => {
    delete cmp.replacements;
  });

  it('marks no replacements when passed no configs', async () => {
    expect(await getReplacements(cmp)).to.be.undefined;
    expect(await getReplacements(cmp, [])).to.be.undefined;
  });
  it('marks a string replacement from env', async () => {
    assert(cmp.xml);
    const result = await getReplacements(cmp, [
      // spec says filename path should be posix.  The mocks are using join, so on windows they are wrong
      { filename: posixifyPaths(cmp.xml), stringToReplace: 'foo', replaceWithEnv: 'FOO_REPLACEMENT' },
    ]);
    expect(result).to.deep.equal({
      [cmp.xml]: [
        {
          matchedFilename: cmp.xml,
          toReplace: stringToRegex('foo'),
          replaceWith: 'bar',
          singleFile: true,
        },
      ],
    });
  });
  it('marks string replacements from file', async () => {
    assert(cmp.xml);
    const result = await getReplacements(cmp, [
      { filename: posixifyPaths(cmp.xml), stringToReplace: 'foo', replaceWithFile: 'bar' },
    ]);
    expect(result).to.deep.equal({
      [cmp.xml]: [
        {
          matchedFilename: cmp.xml,
          toReplace: stringToRegex('foo'),
          replaceWith: 'bar',
          singleFile: true,
        },
      ],
    });
  });

  it('marks regex replacements on a matching file', async () => {
    assert(cmp.xml);
    const result = await getReplacements(cmp, [
      { filename: posixifyPaths(cmp.xml), regexToReplace: '.*foo.*', replaceWithEnv: 'FOO_REPLACEMENT' },
    ]);
    expect(result).to.deep.equal({
      [cmp.xml]: [
        {
          matchedFilename: cmp.xml,
          toReplace: /.*foo.*/g,
          replaceWith: 'bar',
          singleFile: true,
        },
      ],
    });
  });
  it('marks 2 replacements on one file', async () => {
    assert(cmp.xml);
    const result = await getReplacements(cmp, [
      { filename: posixifyPaths(cmp.xml), stringToReplace: 'foo', replaceWithEnv: 'FOO_REPLACEMENT' },
      { filename: posixifyPaths(cmp.xml), stringToReplace: 'baz', replaceWithEnv: 'FOO_REPLACEMENT' },
    ]);
    expect(result).to.deep.equal({
      [cmp.xml]: [
        {
          matchedFilename: cmp.xml,
          toReplace: stringToRegex('foo'),
          replaceWith: 'bar',
          singleFile: true,
        },
        {
          matchedFilename: cmp.xml,
          toReplace: stringToRegex('baz'),
          replaceWith: 'bar',
          singleFile: true,
        },
      ],
    });
  });
  it('marks two files with 1 replacement each for greedy glob', async () => {
    assert(cmp.content);
    assert(cmp.xml);
    const result = await getReplacements(cmp, [
      { glob: '**/*', stringToReplace: 'foo', replaceWithEnv: 'FOO_REPLACEMENT' },
    ]);
    expect(result).to.deep.equal({
      [cmp.xml]: [
        {
          matchedFilename: cmp.xml,
          toReplace: stringToRegex('foo'),
          replaceWith: 'bar',
          singleFile: false,
        },
      ],
      [cmp.content]: [
        {
          matchedFilename: cmp.content,
          toReplace: stringToRegex('foo'),
          replaceWith: 'bar',
          singleFile: false,
        },
      ],
    });
  });
  it('marks replacement on multiple files from multiple configs', async () => {
    assert(cmp.content);
    assert(cmp.xml);
    const result = await getReplacements(cmp, [
      { filename: posixifyPaths(cmp.xml), stringToReplace: 'foo', replaceWithEnv: 'FOO_REPLACEMENT' },
      { filename: posixifyPaths(cmp.content), stringToReplace: 'foo', replaceWithEnv: 'FOO_REPLACEMENT' },
    ]);
    expect(result).to.deep.equal({
      [cmp.xml]: [
        {
          matchedFilename: cmp.xml,
          toReplace: stringToRegex('foo'),
          replaceWith: 'bar',
          singleFile: true,
        },
      ],
      [cmp.content]: [
        {
          matchedFilename: cmp.content,
          toReplace: stringToRegex('foo'),
          replaceWith: 'bar',
          singleFile: true,
        },
      ],
    });
  });

  it('throws when env is missing', async () => {
    assert(cmp.xml);
    try {
      await getReplacements(cmp, [
        { filename: posixifyPaths(cmp.xml), regexToReplace: '.*foo.*', replaceWithEnv: 'BAD_ENV' },
      ]);
      assert.fail('should have thrown');
    } catch (e) {
      expect(e).to.be.instanceOf(Error);
    }
  });
  it('allows unsetEnv when property indicates it can be undefined', async () => {
    assert(cmp.xml);
    const result = await getReplacements(cmp, [
      {
        filename: posixifyPaths(cmp.xml),
        regexToReplace: '.*foo.*',
        replaceWithEnv: 'BAD_ENV',
        allowUnsetEnvVariable: true,
      },
    ]);

    expect(result).to.be.deep.equal({
      [cmp.xml]: [
        {
          matchedFilename: cmp.xml,
          singleFile: true,
          toReplace: /.*foo.*/g,
          replaceWith: '',
        },
      ],
    });
  });
});

describe('executes replacements on a string', () => {
  const matchedFilename = 'foo';
  describe('string', () => {
    it('basic replacement', async () => {
      expect(
        (
          await replacementIterations('ThisIsATest', [
            { matchedFilename, toReplace: stringToRegex('This'), replaceWith: 'That', singleFile: true },
          ])
        ).output
      ).to.equal('ThatIsATest');
    });
    it('same replacement occuring multiple times', async () => {
      expect(
        (
          await replacementIterations('ThisIsATestWithThisAndThis', [
            { matchedFilename, toReplace: stringToRegex('This'), replaceWith: 'That', singleFile: true },
          ])
        ).output
      ).to.equal('ThatIsATestWithThatAndThat');
    });
    it('multiple replacements', async () => {
      expect(
        (
          await replacementIterations('ThisIsATestWithThisAndThis', [
            { matchedFilename, toReplace: stringToRegex('This'), replaceWith: 'That' },
            { matchedFilename, toReplace: stringToRegex('ATest'), replaceWith: 'AnAwesomeTest' },
          ])
        ).output
      ).to.equal('ThatIsAnAwesomeTestWithThatAndThat');
    });
  });
  describe('regex', () => {
    it('basic replacement', async () => {
      expect(
        (
          await replacementIterations('ThisIsATest', [
            { toReplace: /Is/g, replaceWith: 'IsNot', singleFile: true, matchedFilename },
          ])
        ).output
      ).to.equal('ThisIsNotATest');
    });
    it('same replacement occuring multiple times', async () => {
      expect(
        (
          await replacementIterations('ThisIsATestWithThisAndThis', [
            { toReplace: /s/g, replaceWith: 'S', singleFile: true, matchedFilename },
          ])
        ).output
      ).to.equal('ThiSISATeStWithThiSAndThiS');
    });
    it('multiple replacements', async () => {
      expect(
        (
          await replacementIterations('This Is A Test With This And This', [
            { toReplace: /^T.{2}s/, replaceWith: 'That', singleFile: false, matchedFilename },
            { toReplace: /T.{2}s$/, replaceWith: 'Stuff', singleFile: false, matchedFilename },
          ])
        ).output
      ).to.equal('That Is A Test With This And Stuff');
    });
  });

  describe('warning when no replacement happened', () => {
    let warnSpy: Sinon.SinonSpy;
    let emitSpy: Sinon.SinonSpy;
    const matchedFilename = 'foo';

    beforeEach(() => {
      warnSpy = Sinon.spy(Lifecycle.getInstance(), 'emitWarning');
      emitSpy = Sinon.spy(Lifecycle.getInstance(), 'emit');
    });
    afterEach(() => {
      warnSpy.restore();
      emitSpy.restore();
    });

    it('emits warning only when no change in any chunk', async () => {
      const stream = new ReplacementStream([
        { toReplace: stringToRegex('Nope'), replaceWith: 'Nah', singleFile: true, matchedFilename },
      ]);
      await pipeline(Readable.from(['ThisIsATest']), stream);
      expect(warnSpy.callCount).to.equal(1);
    });

    it('does not emit warning when string is replaced in any chunk', async () => {
      const stream = new ReplacementStream([
        { toReplace: stringToRegex('Test'), replaceWith: 'SpyTest', singleFile: true, matchedFilename },
      ]);
      await pipeline(Readable.from(['ThisIsATest']), stream);
      expect(warnSpy.callCount).to.equal(0);
    });

    it('does not emit warning for non-singleFile replacements', async () => {
      const stream = new ReplacementStream([
        { toReplace: stringToRegex('Nope'), replaceWith: 'Nah', singleFile: false, matchedFilename },
      ]);
      await pipeline(Readable.from(['ThisIsATest']), stream);
      expect(warnSpy.callCount).to.equal(0);
    });

    it('emits warning only once for multiple chunks with no match', async () => {
      const stream = new ReplacementStream([
        { toReplace: stringToRegex('Nope'), replaceWith: 'Nah', singleFile: true, matchedFilename },
      ]);
      await pipeline(Readable.from(['ThisIsA', 'Test']), stream);
      expect(warnSpy.callCount).to.equal(1);
    });

    it('does not emit warning if match is found in any chunk', async () => {
      const stream = new ReplacementStream([
        { toReplace: stringToRegex('Test'), replaceWith: 'SpyTest', singleFile: true, matchedFilename },
      ]);
      await pipeline(Readable.from(['ThisIsA', 'Test']), stream);
      expect(warnSpy.callCount).to.equal(0);
    });
  });

  it('performs replacements across chunk boundaries without warnings', async () => {
    const chunkSize = 16 * 1024; // 16KB
    // Create a large string with two replacement targets, one at the start, one at the end
    const before = 'REPLACE_ME_1';
    const after = 'REPLACE_ME_2';
    const middle = 'A'.repeat(chunkSize * 2 - before.length - after.length); // ensure > 2 chunks
    const bigText = before + middle + after;
    const expected = 'DONE_1' + middle + 'DONE_2';
    const stream = new ReplacementStream([
      { toReplace: /REPLACE_ME_1/g, replaceWith: 'DONE_1', singleFile: true, matchedFilename: 'bigfile.txt' },
      { toReplace: /REPLACE_ME_2/g, replaceWith: 'DONE_2', singleFile: true, matchedFilename: 'bigfile.txt' },
    ]);
    const warnSpy = Sinon.spy(Lifecycle.getInstance(), 'emitWarning');
    let result = '';
    stream.on('data', (chunk) => {
      result += chunk.toString();
    });
    // Node.js Readable.from([bigText]) emits the entire string as a single chunk, regardless of its size.
    // To simulate real-world chunking (like fs.createReadStream does for large files), we define a custom
    // Readable that splits the input string into smaller chunks. This allows us to test chunk boundary behavior.
    class ChunkedReadable extends Readable {
      private pos = 0;
      private text: string;
      private chunkLen: number;

      public constructor(text: string, chunkLen: number) {
        super();
        this.text = text;
        this.chunkLen = chunkLen;
      }

      public _read() {
        if (this.pos >= this.text.length) {
          this.push(null);
          return;
        }
        const end = Math.min(this.pos + this.chunkLen, this.text.length);
        this.push(this.text.slice(this.pos, end));
        this.pos = end;
      }
    }
    // Use ChunkedReadable to simulate chunked input
    await pipeline(new ChunkedReadable(bigText, chunkSize), stream);
    expect(result).to.equal(expected);
    expect(warnSpy.callCount).to.equal(0);
    warnSpy.restore();
  });
});
