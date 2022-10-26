/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import { expect } from 'chai';
import Sinon = require('sinon');
import { Lifecycle } from '@salesforce/core';
import { getReplacements, matchesFile, replacementIterations } from '../../src/convert/replacements';
import { matchingContentFile } from '../mock';
import * as replacementsForMock from '../../src/convert/replacements';

describe('file matching', () => {
  const base = { replaceWithEnv: 'foo', stringToReplace: 'foo' };
  it('file matches string', () => {
    expect(matchesFile('foo', { filename: 'foo', ...base })).to.be.true;
    expect(matchesFile('bar', { filename: 'foo', ...base })).to.not.be.true;
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
    const result = await getReplacements(cmp, [
      { filename: cmp.xml, stringToReplace: 'foo', replaceWithEnv: 'FOO_REPLACEMENT' },
    ]);
    expect(result).to.deep.equal({
      [cmp.xml]: [
        {
          toReplace: 'foo',
          replaceWith: 'bar',
          singleFile: true,
        },
      ],
    });
  });
  it('marks string replacements from file', async () => {
    const result = await getReplacements(cmp, [{ filename: cmp.xml, stringToReplace: 'foo', replaceWithFile: 'bar' }]);
    expect(result).to.deep.equal({
      [cmp.xml]: [
        {
          toReplace: 'foo',
          replaceWith: 'bar',
          singleFile: true,
        },
      ],
    });
  });

  it('marks regex replacements on a matching file', async () => {
    const result = await getReplacements(cmp, [
      { filename: cmp.xml, regexToReplace: '.*foo.*', replaceWithEnv: 'FOO_REPLACEMENT' },
    ]);
    expect(result).to.deep.equal({
      [cmp.xml]: [
        {
          toReplace: /.*foo.*/g,
          replaceWith: 'bar',
          singleFile: true,
        },
      ],
    });
  });
  it('marks 2 replacements on one file', async () => {
    const result = await getReplacements(cmp, [
      { filename: cmp.xml, stringToReplace: 'foo', replaceWithEnv: 'FOO_REPLACEMENT' },
      { filename: cmp.xml, stringToReplace: 'baz', replaceWithEnv: 'FOO_REPLACEMENT' },
    ]);
    expect(result).to.deep.equal({
      [cmp.xml]: [
        {
          toReplace: 'foo',
          replaceWith: 'bar',
          singleFile: true,
        },
        {
          toReplace: 'baz',
          replaceWith: 'bar',
          singleFile: true,
        },
      ],
    });
  });
  it('marks two files with 1 replacement each for greedy glob', async () => {
    const result = await getReplacements(cmp, [
      { glob: '**/*', stringToReplace: 'foo', replaceWithEnv: 'FOO_REPLACEMENT' },
    ]);
    expect(result).to.deep.equal({
      [cmp.xml]: [
        {
          toReplace: 'foo',
          replaceWith: 'bar',
          singleFile: false,
        },
      ],
      [cmp.content]: [
        {
          toReplace: 'foo',
          replaceWith: 'bar',
          singleFile: false,
        },
      ],
    });
  });
  it('marks replacement on multiple files from multiple configs', async () => {
    const result = await getReplacements(cmp, [
      { filename: cmp.xml, stringToReplace: 'foo', replaceWithEnv: 'FOO_REPLACEMENT' },
      { filename: cmp.content, stringToReplace: 'foo', replaceWithEnv: 'FOO_REPLACEMENT' },
    ]);
    expect(result).to.deep.equal({
      [cmp.xml]: [
        {
          toReplace: 'foo',
          replaceWith: 'bar',
          singleFile: true,
        },
      ],
      [cmp.content]: [
        {
          toReplace: 'foo',
          replaceWith: 'bar',
          singleFile: true,
        },
      ],
    });
  });
  it('throws when env is missing');
});

describe('executes replacements on a string', () => {
  describe('string', () => {
    it('basic replacement', async () => {
      expect(
        await replacementIterations('ThisIsATest', [{ toReplace: 'This', replaceWith: 'That', singleFile: true }])
      ).to.equal('ThatIsATest');
    });
    it('same replacement occuring multiple times', async () => {
      expect(
        await replacementIterations('ThisIsATestWithThisAndThis', [
          { toReplace: 'This', replaceWith: 'That', singleFile: true },
        ])
      ).to.equal('ThatIsATestWithThatAndThat');
    });
    it('multiple replacements', async () => {
      expect(
        await replacementIterations('ThisIsATestWithThisAndThis', [
          { toReplace: 'This', replaceWith: 'That' },
          { toReplace: 'ATest', replaceWith: 'AnAwesomeTest' },
        ])
      ).to.equal('ThatIsAnAwesomeTestWithThatAndThat');
    });
  });
  describe('regex', () => {
    it('basic replacement', async () => {
      expect(
        await replacementIterations('ThisIsATest', [{ toReplace: /Is/g, replaceWith: 'IsNot', singleFile: true }])
      ).to.equal('ThisIsNotATest');
    });
    it('same replacement occuring multiple times', async () => {
      expect(
        await replacementIterations('ThisIsATestWithThisAndThis', [
          { toReplace: /s/g, replaceWith: 'S', singleFile: true },
        ])
      ).to.equal('ThiSISATeStWithThiSAndThiS');
    });
    it('multiple replacements', async () => {
      expect(
        await replacementIterations('This Is A Test With This And This', [
          { toReplace: /^T.{2}s/, replaceWith: 'That', singleFile: false },
          { toReplace: /T.{2}s$/, replaceWith: 'Stuff', singleFile: false },
        ])
      ).to.equal('That Is A Test With This And Stuff');
    });
  });

  describe('warning when no replacement happened', () => {
    let warnSpy: Sinon.SinonSpy;

    beforeEach(() => {
      warnSpy = Sinon.spy(Lifecycle.getInstance(), 'emitWarning');
    });
    afterEach(() => {
      warnSpy.restore();
    });
    it('emits warning only when no change', async () => {
      await replacementIterations('ThisIsATest', [{ toReplace: 'Nope', replaceWith: 'Nah', singleFile: true }]);
      expect(warnSpy.callCount).to.equal(1);
    });
    it('no warning when string is replaced', async () => {
      await replacementIterations('ThisIsATest', [{ toReplace: 'Test', replaceWith: 'SpyTest', singleFile: true }]);
      expect(warnSpy.callCount).to.equal(0);
    });
    it('no warning when no replacement but not a single file (ex: glob)', async () => {
      await replacementIterations('ThisIsATest', [{ toReplace: 'Nope', replaceWith: 'Nah', singleFile: false }]);
      expect(warnSpy.callCount).to.equal(0);
    });
  });
});
