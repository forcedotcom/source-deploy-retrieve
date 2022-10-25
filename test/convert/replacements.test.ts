/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import Sinon = require('sinon');
import { getReplacements, matchesFile } from '../../src/convert/replacements';
import { matchingContentFile } from '../mock';
import * as replacementsForMock from '../../src/convert/replacements';

describe('file matching', () => {
  const base = { replaceWithEnv: 'foo', stringToReplace: 'foo' };
  it('file matches string', () => {
    expect(matchesFile('foo', { filename: 'foo', ...base })).to.be.true;
    expect(matchesFile('bar', { filename: 'foo', ...base })).to.not.be.true;
  });
  it('file matches glob', () => {
    expect(matchesFile('foo/bar', { glob: 'foo/**', ...base })).to.be.true;
    expect(matchesFile('foo/bar', { glob: 'foo/*', ...base })).to.be.true;
    expect(matchesFile('foo/bar', { glob: 'foo', ...base })).to.be.false;
    expect(matchesFile('foo/bar', { glob: '**/*', ...base })).to.be.true;
  });
  it('test absolute vs. relative paths');
});

describe('env filters', () => {});

describe('marking replacements on a component', () => {
  before(() => {
    // replaceFromFile uses the contents of a file.  This prevents the test from hitting real FS for that.
    Sinon.stub(replacementsForMock, 'getContents').resolves('bar');
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
          toReplace: /.*foo.*/,
          replaceWith: 'bar',
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
        },
        {
          toReplace: 'baz',
          replaceWith: 'bar',
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
        },
      ],
      [cmp.content]: [
        {
          toReplace: 'foo',
          replaceWith: 'bar',
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
        },
      ],
      [cmp.content]: [
        {
          toReplace: 'foo',
          replaceWith: 'bar',
        },
      ],
    });
  });
});
