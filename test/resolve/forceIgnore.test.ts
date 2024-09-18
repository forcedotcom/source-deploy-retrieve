/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'node:path';
import { expect } from 'chai';
import { createSandbox } from 'sinon';
import fs from 'graceful-fs';
import { Lifecycle } from '@salesforce/core';
import { ForceIgnore } from '../../src/resolve/forceIgnore';
import * as fsUtil from '../../src/utils/fileSystemHandler';

const env = createSandbox();

describe('ForceIgnore', () => {
  const forceIgnorePath = join('some', ForceIgnore.FILE_NAME);
  const testPath = join('some', 'path', '__tests__', 'myTest.x');
  const testPattern = '**/__tests__/**';

  afterEach(() => env.restore());

  it('Should default to not ignoring a file if forceignore is not loaded', () => {
    const path = join('some', 'path');
    const forceIgnore = new ForceIgnore();
    expect(forceIgnore.accepts(path)).to.be.true;
    expect(forceIgnore.denies(path)).to.be.false;
  });

  it('Should ignore files with a given pattern', () => {
    env.stub(fs, 'readFileSync').returns(testPattern);
    const forceIgnore = new ForceIgnore(forceIgnorePath);
    expect(forceIgnore.accepts(testPath)).to.be.false;
    expect(forceIgnore.denies(testPath)).to.be.true;
  });

  it('windows separators no longer have any effect', () => {
    const lifecycleStub = env.stub(Lifecycle.prototype, 'emitWarning');
    const forceIgnoreEntry = 'force-app\\main\\default\\classes\\myApex.*';
    const pathToClass = join('force-app', 'main', 'default', 'classes', 'myApex.cls');
    env.stub(fs, 'readFileSync').returns(forceIgnoreEntry);

    const forceIgnore = new ForceIgnore();

    expect(forceIgnore.accepts(pathToClass)).to.be.true;
    expect(lifecycleStub.callCount).to.equal(1);
  });

  it('Should find a forceignore file from a given path', () => {
    const readStub = env.stub(fs, 'readFileSync');
    const searchStub = env.stub(fsUtil, 'searchUp');
    readStub.withArgs(forceIgnorePath).returns(testPattern);
    searchStub.withArgs(testPath, ForceIgnore.FILE_NAME).returns(forceIgnorePath);
    const forceIgnore = ForceIgnore.findAndCreate(testPath);
    expect(forceIgnore.accepts(testPath)).to.be.false;
  });

  it('Should handle forward slashes on windows', () => {
    const readStub = env.stub(fs, 'readFileSync');
    readStub.withArgs(forceIgnorePath).returns('force-app/main/default/classes/');
    const fi = new ForceIgnore(forceIgnorePath);
    // @ts-ignore private field
    expect(fi.parser, 'if constructor throws, parser is not defined').to.not.equal(undefined);
  });

  it('Should have the correct default in the case the parsers are not initialized', () => {
    const readStub = env.stub(fs, 'readFileSync');
    readStub.withArgs(forceIgnorePath).returns('force-app/main/default/classes/');
    const fi = new ForceIgnore(forceIgnorePath);
    expect(fi.accepts(join('force-app', 'main', 'default', 'classes'))).to.be.true;
  });

  describe('Defaults with new parser', () => {
    let forceIgnore: ForceIgnore;
    const root = join('some', 'path');

    beforeEach(() => {
      env.stub(fs, 'readFileSync').returns('');
      forceIgnore = new ForceIgnore();
    });

    // these examples test the default behaviors - check the cache behavior with the duplicate 'abc.dup'
    const forceIgnoreExamples = ['abc.dup', 'abc.dup', '.xyz', 'package2-descriptor.json', 'package2-manifest.json'];
    forceIgnoreExamples.map((ignore) => {
      it(`Should ignore files starting with a ${ignore}`, () => {
        const testPath = join(root, ignore);

        expect(forceIgnore.accepts(testPath)).to.be.false;
        expect(forceIgnore.denies(testPath)).to.be.true;
      });
    });

    it('Should allow .forceignore file to override defaults', () => {
      // tamper with the file
      env.restore();
      env.stub(fs, 'readFileSync').returns('!**/.*');
      forceIgnore = new ForceIgnore();

      const dotFilePath = join(root, '.foo');
      expect(forceIgnore.accepts(dotFilePath)).to.be.true;
      expect(forceIgnore.denies(dotFilePath)).to.be.false;
    });
  });
});
