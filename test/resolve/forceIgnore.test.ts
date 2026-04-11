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
import { mkdirSync, mkdtempSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import type { Stats } from 'node:fs';
import { join } from 'node:path';
import * as os from 'node:os';
import { expect } from 'chai';
import Sinon, { createSandbox } from 'sinon';
import fs from 'graceful-fs';
import { Lifecycle } from '@salesforce/core';
import { Logger } from '@salesforce/core/logger';
import { ForceIgnore } from '../../src/resolve/forceIgnore';
import * as fsUtil from '../../src/utils/fileSystemHandler';

const env = createSandbox();

describe('ForceIgnore', () => {
  const forceIgnorePath = join('some', ForceIgnore.FILE_NAME);
  const testPath = join('some', 'path', '__tests__', 'myTest.x');
  const testPattern = '**/__tests__/**';

  afterEach(() => {
    env.restore();
    Sinon.restore();
    ForceIgnore.clearCacheForTest();
  });

  it('Should default to not ignoring a file if forceignore is not loaded', () => {
    const path = join('some', 'path');
    const forceIgnore = new ForceIgnore();
    expect(forceIgnore.accepts(path)).to.be.true;
    expect(forceIgnore.denies(path)).to.be.false;
  });

  it('Should ignore files with a given pattern', () => {
    env.stub(fs, 'readFileSync').returns(testPattern);
    const debugSpy = Sinon.spy(Logger.prototype, 'debug');
    const forceIgnore = new ForceIgnore(forceIgnorePath);
    expect(forceIgnore.accepts(testPath)).to.be.false;
    expect(forceIgnore.denies(testPath)).to.be.true;
    // accepts() delegates to denies(), so debug fires once per call (twice total)
    expect(debugSpy.callCount).to.equal(2);
    expect(debugSpy.getCall(0).args[0]).to.match(/Ignoring .+ because it matched .forceignore patterns\./g);
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

  it('will not warn for \\ on commented lines', () => {
    const lifecycleStub = env.stub(Lifecycle.prototype, 'emitWarning');
    const forceIgnoreEntry = `# force-app\\main\\default\\classes\\myApex.* ${os.EOL} force-app\\main\\default\\classes\\myApex.*`;
    const pathToClass = join('force-app', 'main', 'default', 'classes', 'myApex.cls');
    env.stub(fs, 'readFileSync').returns(forceIgnoreEntry);

    const forceIgnore = new ForceIgnore();

    expect(forceIgnore.accepts(pathToClass)).to.be.true;
    // once, second line is uncommented, but uses \
    expect(lifecycleStub.callCount).to.equal(1);
  });

  it('Should find a forceignore file from a given path', () => {
    const readStub = env.stub(fs, 'readFileSync');
    const searchStub = env.stub(fsUtil, 'searchUp');
    env.stub(fs, 'statSync').returns({ mtimeMs: 99, size: 500 } as Stats);
    readStub.withArgs(forceIgnorePath).returns(testPattern);
    searchStub.withArgs(testPath, ForceIgnore.FILE_NAME).returns(forceIgnorePath);
    const forceIgnore = ForceIgnore.findAndCreate(testPath);
    expect(forceIgnore.accepts(testPath)).to.be.false;
  });

  describe('findAndCreate cache', () => {
    it('reuses the same instance and reads .forceignore once when mtime/size unchanged', () => {
      const tmp = mkdtempSync(join(os.tmpdir(), 'sdr-fi-cache-'));
      const fiPath = join(tmp, ForceIgnore.FILE_NAME);
      writeFileSync(fiPath, `${testPattern}\n`);
      mkdirSync(join(tmp, 'pkg', 'classes'), { recursive: true });
      const seedA = join(tmp, 'pkg', 'classes');
      const seedB = join(tmp, 'pkg', 'classes', 'Foo.cls');
      const readSpy = env.spy(fs, 'readFileSync');
      const first = ForceIgnore.findAndCreate(seedA);
      const second = ForceIgnore.findAndCreate(seedB);
      expect(first).to.equal(second);
      const readsForFi = readSpy
        .getCalls()
        .filter((c) => typeof c.args[0] === 'string' && c.args[0].endsWith(ForceIgnore.FILE_NAME));
      expect(readsForFi.length).to.equal(1);
    });

    it('reloads when .forceignore mtime or size changes', () => {
      const tmp = mkdtempSync(join(os.tmpdir(), 'sdr-fi-inv-'));
      const fiPath = join(tmp, ForceIgnore.FILE_NAME);
      writeFileSync(fiPath, '**/old/**\n');
      mkdirSync(join(tmp, 'force-app'), { recursive: true });
      const seed = join(tmp, 'force-app');
      const readSpy = env.spy(fs, 'readFileSync');
      ForceIgnore.findAndCreate(seed);
      writeFileSync(fiPath, '**/new/**\n');
      ForceIgnore.findAndCreate(seed);
      const readsForFi = readSpy
        .getCalls()
        .filter((c) => typeof c.args[0] === 'string' && c.args[0].endsWith(ForceIgnore.FILE_NAME));
      expect(readsForFi.length).to.equal(2);
    });

    it('cache hit: repeated findAndCreate keeps the same deny/accept behavior (no stale rules)', () => {
      const tmp = mkdtempSync(join(os.tmpdir(), 'sdr-fi-cache-hit-'));
      const fiPath = join(tmp, ForceIgnore.FILE_NAME);
      const watched = join(tmp, 'cache-hit-marker.txt');
      writeFileSync(fiPath, 'cache-hit-marker.txt\n');
      mkdirSync(join(tmp, 'pkg'), { recursive: true });
      const seed = join(tmp, 'pkg');

      const a = ForceIgnore.findAndCreate(seed);
      const b = ForceIgnore.findAndCreate(join(seed, 'nested'));
      expect(a).to.equal(b);
      expect(a.denies(watched)).to.be.true;
      expect(b.denies(watched)).to.be.true;
    });

    it('after user edits .forceignore, reload applies new rules (not a stale cache)', () => {
      const tmp = mkdtempSync(join(os.tmpdir(), 'sdr-fi-cache-edit-'));
      const fiPath = join(tmp, ForceIgnore.FILE_NAME);
      const watched = join(tmp, 'user-edit-marker.txt');
      writeFileSync(fiPath, 'user-edit-marker.txt\n');
      mkdirSync(join(tmp, 'force-app'), { recursive: true });
      const seed = join(tmp, 'force-app');

      const before = ForceIgnore.findAndCreate(seed);
      expect(before.denies(watched)).to.be.true;

      writeFileSync(fiPath, '# user cleared patterns\n');
      const after = ForceIgnore.findAndCreate(seed);
      expect(after).to.not.equal(before);
      expect(after.denies(watched)).to.be.false;
    });

    it('after user removes .forceignore, findAndCreate stops denying paths (no file → empty rules)', () => {
      const tmp = mkdtempSync(join(os.tmpdir(), 'sdr-fi-cache-rm-'));
      const fiPath = join(tmp, ForceIgnore.FILE_NAME);
      const watched = join(tmp, 'removed-rule.txt');
      writeFileSync(fiPath, 'removed-rule.txt\n');
      mkdirSync(join(tmp, 'src'), { recursive: true });
      const seed = join(tmp, 'src');

      const loaded = ForceIgnore.findAndCreate(seed);
      expect(loaded.denies(watched)).to.be.true;

      unlinkSync(fiPath);
      const empty = ForceIgnore.findAndCreate(seed);
      expect(empty.denies(watched)).to.be.false;
    });

    it('when user adds a new .forceignore, findAndCreate picks up rules (was accepting, now denies)', () => {
      const tmp = mkdtempSync(join(os.tmpdir(), 'sdr-fi-cache-add-'));
      mkdirSync(join(tmp, 'force-app'), { recursive: true });
      const seed = join(tmp, 'force-app');
      const watched = join(tmp, 'newly-ignored.txt');

      const before = ForceIgnore.findAndCreate(seed);
      expect(before.denies(watched)).to.be.false;

      writeFileSync(join(tmp, ForceIgnore.FILE_NAME), 'newly-ignored.txt\n');
      const after = ForceIgnore.findAndCreate(seed);
      expect(after).to.not.equal(before);
      expect(after.denies(watched)).to.be.true;
    });
  });

  describe('directory-only patterns (trailing slash in .forceignore)', () => {
    beforeEach(() => {
      env.stub(fs, 'readFileSync').returns('node_modules/');
    });

    it('denies a path matching a trailing-slash pattern (real or virtual directory)', () => {
      const fi = new ForceIgnore(forceIgnorePath);
      expect(fi.denies(join('some', 'node_modules'))).to.be.true;
    });

    it('accepts returns false for a path matching a trailing-slash pattern', () => {
      const fi = new ForceIgnore(forceIgnorePath);
      expect(fi.accepts(join('some', 'node_modules'))).to.be.false;
    });

    it('does not deny an unrelated path', () => {
      const fi = new ForceIgnore(forceIgnorePath);
      expect(fi.denies(join('some', 'node_modules_extra'))).to.be.false;
    });
  });

  describe('directory-only pattern vs file path (trailing-slash OR false positive)', () => {
    it.skip('denies a regular file whose basename matches a directory-only rule (gitignore would not)', () => {
      const tmp = mkdtempSync(join(os.tmpdir(), 'sdr-fi-buildfile-'));
      const sfdxProject = {
        name: 'falsePositiveProj',
        namespace: '',
        packageDirectories: [{ default: true, path: 'force-app' }],
        sfdcLoginUrl: 'https://login.salesforce.com',
        sourceApiVersion: '58.0',
      };
      writeFileSync(join(tmp, 'sfdx-project.json'), `${JSON.stringify(sfdxProject, null, 2)}\n`);
      mkdirSync(join(tmp, 'force-app', 'main', 'default'), { recursive: true });
      const filePath = join(tmp, 'force-app', 'main', 'default', 'build');
      writeFileSync(filePath, '# build output placeholder\n');
      expect(statSync(filePath).isFile()).to.be.true;

      writeFileSync(join(tmp, ForceIgnore.FILE_NAME), 'build/\n');
      const fi = new ForceIgnore(join(tmp, ForceIgnore.FILE_NAME));

      // Gitignore / node-ignore: pattern `build/` applies only to directories named `build`.
      // `ignores('force-app/main/default/build')` is false for a file at that path, but
      // ForceIgnore also tests `.../build/`, which matches the directory-only pattern—so
      // this file is incorrectly treated as ignored (false positive).
      expect(fi.denies(filePath)).to.be.false;
    });
  });

  it('Should handle forward slashes on windows', () => {
    const readStub = env.stub(fs, 'readFileSync');
    readStub.withArgs(forceIgnorePath).returns('force-app/main/default/classes/');
    const fi = new ForceIgnore(forceIgnorePath);
    // @ts-ignore private field
    expect(fi.parser, 'if constructor throws, parser is not defined').to.not.equal(undefined);
  });

  it('Should deny a directory path matching a trailing-slash pattern', () => {
    const readStub = env.stub(fs, 'readFileSync');
    readStub.withArgs(forceIgnorePath).returns('force-app/main/default/classes/');
    const fi = new ForceIgnore(forceIgnorePath);
    // Both the path and path+'/' are tested, so directory-only patterns match correctly
    // even without filesystem access (virtual trees, zip containers, etc.)
    expect(fi.accepts(join('force-app', 'main', 'default', 'classes'))).to.be.false;
    expect(fi.denies(join('force-app', 'main', 'default', 'classes'))).to.be.true;
  });

  /**
   * TODO: Rework when approach to default patterns changes. We should be able
   * to generally test the defaults system.
   */
  describe('Defaults with new parser', () => {
    let forceIgnore: ForceIgnore;
    const root = join('some', 'path');

    beforeEach(() => {
      env.stub(fs, 'readFileSync').returns('');
      forceIgnore = new ForceIgnore();
    });

    it('Should ignore files starting with a dot', () => {
      const dotPath = join(root, '.xyz');
      expect(forceIgnore.accepts(dotPath)).to.be.false;
      expect(forceIgnore.denies(dotPath)).to.be.true;
    });

    it('Should NOT ignore .sf directory itself', () => {
      expect(forceIgnore.accepts(join(root, '.sf'))).to.be.true;
      expect(forceIgnore.denies(join(root, '.sf'))).to.be.false;
    });

    it('Should NOT ignore .sf/orgs directory itself', () => {
      expect(forceIgnore.accepts(join(root, '.sf', 'orgs'))).to.be.true;
      expect(forceIgnore.denies(join(root, '.sf', 'orgs'))).to.be.false;
    });

    it('Should NOT ignore .sf/orgs/<orgId> directory itself', () => {
      // **/.sf/orgs/*/** requires a path component after the orgId, so the orgId dir itself is accepted
      expect(forceIgnore.accepts(join(root, '.sf', 'orgs', '00D000000000000'))).to.be.true;
      expect(forceIgnore.denies(join(root, '.sf', 'orgs', '00D000000000000'))).to.be.false;
    });

    it('Should ignore content inside .sf/orgs/<orgId> that is not remoteMetadata', () => {
      expect(forceIgnore.accepts(join(root, '.sf', 'orgs', '00D000000000000', 'foo'))).to.be.false;
      expect(forceIgnore.denies(join(root, '.sf', 'orgs', '00D000000000000', 'foo'))).to.be.true;
    });

    it('Should NOT ignore .sf/orgs/<orgId>/remoteMetadata', () => {
      const remoteMetadataPath = join(root, '.sf', 'orgs', '00D000000000000', 'remoteMetadata');
      expect(forceIgnore.accepts(remoteMetadataPath)).to.be.true;
      expect(forceIgnore.denies(remoteMetadataPath)).to.be.false;
    });

    it('Should NOT ignore stuff inside .sf/orgs/<orgId>/remoteMetadata', () => {
      const remoteMetadataPath = join(root, '.sf', 'orgs', '00D000000000000', 'remoteMetadata', 'foo', 'bar');
      expect(forceIgnore.accepts(remoteMetadataPath)).to.be.true;
      expect(forceIgnore.denies(remoteMetadataPath)).to.be.false;
    });

    it('Should ignore .sf/orgs/<orgId>/anythingElse', () => {
      const dotSfNotInRemoteMetadata = join(root, '.sf', 'orgs', '00D000000000000', 'foo');
      expect(forceIgnore.accepts(dotSfNotInRemoteMetadata)).to.be.false;
      expect(forceIgnore.denies(dotSfNotInRemoteMetadata)).to.be.true;
    });

    it('Should ignore .sf/anythingElse', () => {
      const dotSfNotInRemoteMetadata = join(root, '.sf', 'foo');
      expect(forceIgnore.accepts(dotSfNotInRemoteMetadata)).to.be.false;
      expect(forceIgnore.denies(dotSfNotInRemoteMetadata)).to.be.true;
    });

    it('Should ignore files ending in .dup', () => {
      const dupPath = join(root, 'abc.dup');

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
