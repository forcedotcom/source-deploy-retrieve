/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'node:path';
import { assert, expect, config } from 'chai';
import Sinon = require('sinon');
import { Lifecycle } from '@salesforce/core';
import {
  getReplacements,
  matchesFile,
  replacementIterations,
  stringToRegex,
  posixifyPaths,
} from '../../src/convert/replacements';
import { matchingContentFile } from '../mock';
import * as replacementsForMock from '../../src/convert/replacements';

config.truncateThreshold = 0;

describe('file matching', () => {
  const base = { replaceWithEnv: 'foo', stringToReplace: 'foo' };
  it('file matches string', () => {
    expect(matchesFile('foo', { filename: 'foo', ...base })).to.be.true;
    expect(matchesFile('bar', { filename: 'foo', ...base })).to.not.be.true;
  });
  it('paths with separators to cover possibility of windows paths', () => {
    expect(matchesFile(path.join('foo', 'bar'), { filename: 'foo/bar', ...base })).to.be.true;
    expect(matchesFile(path.join('foo', 'bar'), { filename: 'foo/baz', ...base })).to.not.be.true;
  });
  it('file matches glob (posix paths)', () => {
    expect(matchesFile('foo/bar', { glob: 'foo/**', ...base })).to.be.true;
    expect(matchesFile('foo/bar', { glob: 'foo/*', ...base })).to.be.true;
    expect(matchesFile('foo/bar', { glob: 'foo', ...base })).to.be.false;
    expect(matchesFile('foo/bar', { glob: '**/*', ...base })).to.be.true;
  });
  it('file matches glob (os-dependent paths)', () => {
    expect(matchesFile(path.join('foo', 'bar'), { glob: 'foo/**', ...base })).to.be.true;
    expect(matchesFile(path.join('foo', 'bar'), { glob: 'foo/*', ...base })).to.be.true;
    expect(matchesFile(path.join('foo', 'bar'), { glob: 'foo', ...base })).to.be.false;
    expect(matchesFile(path.join('foo', 'bar'), { glob: '**/*', ...base })).to.be.true;
  });
  it('test absolute vs. relative paths');
});

describe('env filters', () => {});

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
        await replacementIterations('ThisIsATest', [
          { matchedFilename, toReplace: stringToRegex('This'), replaceWith: 'That', singleFile: true },
        ])
      ).to.equal('ThatIsATest');
    });
    it('same replacement occuring multiple times', async () => {
      expect(
        await replacementIterations('ThisIsATestWithThisAndThis', [
          { matchedFilename, toReplace: stringToRegex('This'), replaceWith: 'That', singleFile: true },
        ])
      ).to.equal('ThatIsATestWithThatAndThat');
    });
    it('multiple replacements', async () => {
      expect(
        await replacementIterations('ThisIsATestWithThisAndThis', [
          { matchedFilename, toReplace: stringToRegex('This'), replaceWith: 'That' },
          { matchedFilename, toReplace: stringToRegex('ATest'), replaceWith: 'AnAwesomeTest' },
        ])
      ).to.equal('ThatIsAnAwesomeTestWithThatAndThat');
    });
  });
  describe('regex', () => {
    it('basic replacement', async () => {
      expect(
        await replacementIterations('ThisIsATest', [
          { toReplace: /Is/g, replaceWith: 'IsNot', singleFile: true, matchedFilename },
        ])
      ).to.equal('ThisIsNotATest');
    });
    it('same replacement occuring multiple times', async () => {
      expect(
        await replacementIterations('ThisIsATestWithThisAndThis', [
          { toReplace: /s/g, replaceWith: 'S', singleFile: true, matchedFilename },
        ])
      ).to.equal('ThiSISATeStWithThiSAndThiS');
    });
    it('multiple replacements', async () => {
      expect(
        await replacementIterations('This Is A Test With This And This', [
          { toReplace: /^T.{2}s/, replaceWith: 'That', singleFile: false, matchedFilename },
          { toReplace: /T.{2}s$/, replaceWith: 'Stuff', singleFile: false, matchedFilename },
        ])
      ).to.equal('That Is A Test With This And Stuff');
    });
  });

  describe('warning when no replacement happened', () => {
    let warnSpy: Sinon.SinonSpy;
    let emitSpy: Sinon.SinonSpy;

    beforeEach(() => {
      // everything is an emit.  Warn calls emit, too.
      warnSpy = Sinon.spy(Lifecycle.getInstance(), 'emitWarning');
      emitSpy = Sinon.spy(Lifecycle.getInstance(), 'emit');
    });
    afterEach(() => {
      warnSpy.restore();
      emitSpy.restore();
    });
    it('emits warning only when no change', async () => {
      await replacementIterations('ThisIsATest', [
        { toReplace: stringToRegex('Nope'), replaceWith: 'Nah', singleFile: true, matchedFilename },
      ]);
      expect(warnSpy.callCount).to.equal(1);
      expect(emitSpy.callCount).to.equal(1);
    });
    it('no warning when string is replaced', async () => {
      await replacementIterations('ThisIsATest', [
        { toReplace: stringToRegex('Test'), replaceWith: 'SpyTest', singleFile: true, matchedFilename },
      ]);
      expect(warnSpy.callCount).to.equal(0);
      // because it emits the replacement event
      expect(emitSpy.callCount).to.equal(1);
    });
    it('no warning when no replacement but not a single file (ex: glob)', async () => {
      await replacementIterations('ThisIsATest', [
        { toReplace: stringToRegex('Nope'), replaceWith: 'Nah', singleFile: false, matchedFilename },
      ]);
      expect(warnSpy.callCount).to.equal(0);
      expect(emitSpy.callCount).to.equal(0);
    });
  });
});
