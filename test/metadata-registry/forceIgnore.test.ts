/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ForceIgnore } from '../../src/metadata-registry';
import { expect } from 'chai';
import { createSandbox } from 'sinon';
import * as fs from 'fs';
import * as fsUtil from '../../src/utils/fileSystemHandler';
import { dirname, join, relative } from 'path';
import { Lifecycle } from '@salesforce/core';
// @ts-ignore this doesn't have typings
import * as gitignoreParser from 'gitignore-parser';
import ignore from 'ignore';
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
    const readStub = env.stub(fs, 'readFileSync');
    readStub.withArgs(forceIgnorePath).returns(testPattern);
    const forceIgnore = new ForceIgnore(forceIgnorePath);
    expect(forceIgnore.accepts(testPath)).to.be.false;
    expect(forceIgnore.denies(testPath)).to.be.true;
  });

  it('Should find a forceignore file from a given path', () => {
    const readStub = env.stub(fs, 'readFileSync');
    const searchStub = env.stub(fsUtil, 'searchUp');
    readStub.withArgs(forceIgnorePath).returns(testPattern);
    searchStub.withArgs(testPath, ForceIgnore.FILE_NAME).returns(forceIgnorePath);
    const forceIgnore = ForceIgnore.findAndCreate(testPath);
    expect(forceIgnore.accepts(testPath)).to.be.false;
  });

  it('should send telemetry event when the old parser and the new parser have different results testing old parser', () => {
    const readStub = env.stub(fs, 'readFileSync');
    const testPattern = '*__tests__*';
    readStub.withArgs(forceIgnorePath).returns(testPattern);
    const forceIgnore = new ForceIgnore(forceIgnorePath);
    const file = join('some', 'path', '__tests__', 'myTest.x');
    // @ts-ignore private member
    env.stub(forceIgnore.gitignoreParser, 'accepts').returns(false);
    // @ts-ignore private member
    env.stub(forceIgnore.parser, 'ignores').returns(false);

    // @ts-ignore parseContents is private
    const oldParser = gitignoreParser.compile(forceIgnore.parseContents(testPattern));
    const newParser = ignore().add([testPattern]);

    env.stub(oldParser, 'accepts').returns(false);
    env.stub(newParser, 'ignores').returns(true);

    const telemetrySpy = env.stub(Lifecycle.prototype, 'emit');

    const expected = {
      eventName: 'FORCE_IGNORE_DIFFERENCE',
      content: testPattern,
      oldLibraryResults: false,
      newLibraryResults: true,
      ignoreLines: [testPattern],
      file: relative(dirname(forceIgnorePath), file),
    };

    forceIgnore.accepts(file);

    expect(telemetrySpy.calledOnce).to.be.true;
    expect(telemetrySpy.args[0][0]).to.equal('telemetry');
    expect(telemetrySpy.args[0][1]).to.deep.equal(expected);
  });

  it('should send telemetry event when the old parser and the new parser have different results testing new parser', () => {
    const readStub = env.stub(fs, 'readFileSync');
    const switchParser = '# .forceignore v2';
    const testPattern = '*__tests__*';
    const entries = testPattern + '\n' + switchParser;
    readStub.withArgs(forceIgnorePath).returns(entries);
    const forceIgnore = new ForceIgnore(forceIgnorePath);
    const telemetrySpy = env.spy(Lifecycle.prototype, 'emit');

    const file = join('some', 'path', '__tests__', 'myTest.x');

    // @ts-ignore private member
    env.stub(forceIgnore.gitignoreParser, 'accepts').returns(false);
    // @ts-ignore private member
    env.stub(forceIgnore.parser, 'ignores').returns(false);

    // @ts-ignore parseContents is private
    const oldParser = gitignoreParser.compile(forceIgnore.parseContents(testPattern));
    const newParser = ignore().add([testPattern]);

    env.stub(oldParser, 'accepts').returns(false);
    env.stub(newParser, 'ignores').returns(true);

    const expected = {
      eventName: 'FORCE_IGNORE_DIFFERENCE',
      content: entries,
      oldLibraryResults: false,
      newLibraryResults: true,
      ignoreLines: [testPattern, switchParser],
      file: relative(dirname(forceIgnorePath), file),
    };

    forceIgnore.accepts(file);

    expect(telemetrySpy.calledOnce).to.be.true;
    expect(telemetrySpy.args[0][0]).to.equal('telemetry');
    expect(telemetrySpy.args[0][1]).to.deep.equal(expected);
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
    // @ts-ignore private field
    expect(fi.accepts(join('force-app', 'main', 'default', 'classes'))).to.be.true;
  });

  /**
   * TODO: Rework when approach to default patterns changes. We should be able
   * to generally test the defaults system.
   */
  describe('Defaults with new parser', () => {
    let forceIgnore: ForceIgnore;
    const root = join('some', 'path');

    beforeEach(() => {
      // when using the new parser, respect the defaults
      env.stub(fs, 'readFileSync').returns('# .forceignore v2');
      forceIgnore = new ForceIgnore();
    });

    it('Should ignore files starting with a dot', () => {
      const dotPath = join(root, '.xyz');
      const telemetrySpy = env.spy(Lifecycle.prototype, 'emit');
      expect(telemetrySpy.called).to.be.false;

      expect(forceIgnore.accepts(dotPath)).to.be.false;
      expect(forceIgnore.denies(dotPath)).to.be.true;
    });

    it('Should ignore files ending in .dup', () => {
      const dupPath = join(root, 'abc.dup');
      const telemetrySpy = env.spy(Lifecycle.prototype, 'emit');
      expect(telemetrySpy.called).to.be.false;

      expect(forceIgnore.accepts(dupPath)).to.be.false;
      expect(forceIgnore.denies(dupPath)).to.be.true;
    });

    it('Should ignore files named package2-descriptor.json', () => {
      const descriptorPath = join(root, 'package2-descriptor.json');
      expect(forceIgnore.accepts(descriptorPath)).to.be.false;
      expect(forceIgnore.denies(descriptorPath)).to.be.true;
    });

    it('Should ignore files named package2-manifest.json', () => {
      const manifestPath = join(root, 'package2-manifest.json');
      expect(forceIgnore.accepts(manifestPath)).to.be.false;
      expect(forceIgnore.denies(manifestPath)).to.be.true;
    });
  });

  describe('Defaults with old parser', () => {
    let forceIgnore: ForceIgnore;
    const root = join('some', 'path');

    beforeEach(() => {
      env.stub(fs, 'readFileSync').returns('');
      forceIgnore = new ForceIgnore();
    });

    it('Should ignore files starting with a dot', () => {
      const dotPath = join(root, '.xyz');
      expect(forceIgnore.accepts(dotPath)).to.be.true;
      expect(forceIgnore.denies(dotPath)).to.be.false;
    });

    it('Should ignore files ending in .dup', () => {
      const dupPath = join(root, 'abc.dup');
      const telemetrySpy = env.spy(Lifecycle.prototype, 'emit');
      expect(telemetrySpy.called).to.be.false;

      expect(forceIgnore.accepts(dupPath)).to.be.true;
      expect(forceIgnore.denies(dupPath)).to.be.false;
    });

    it('Should ignore files named package2-descriptor.json', () => {
      const descriptorPath = join(root, 'package2-descriptor.json');
      expect(forceIgnore.accepts(descriptorPath)).to.be.true;
      expect(forceIgnore.denies(descriptorPath)).to.be.false;
    });

    it('Should ignore files named package2-manifest.json', () => {
      const manifestPath = join(root, 'package2-manifest.json');
      expect(forceIgnore.accepts(manifestPath)).to.be.true;
      expect(forceIgnore.denies(manifestPath)).to.be.false;
    });
  });
});
