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
import os from 'node:os';
import { SinonStub, createSandbox } from 'sinon';
import { expect, config } from 'chai';
import fs from 'graceful-fs';
import { searchUp, findSymlinkOnPath, findSymlinkOnPathSync } from '../../src/utils/fileSystemHandler';

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

  describe('findSymlinkOnPath', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(join(os.tmpdir(), 'sdr-symlink-test-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should return undefined when no symlinks exist', async () => {
      const sub = join(tmpDir, 'a', 'b');
      fs.mkdirSync(sub, { recursive: true });
      const dest = join(sub, 'file.cls');
      fs.writeFileSync(dest, 'content');

      expect(await findSymlinkOnPath(tmpDir, dest)).to.be.undefined;
    });

    it('should detect a symlinked file at the destination', async () => {
      const external = join(tmpDir, 'external.txt');
      fs.writeFileSync(external, 'external');
      const sub = join(tmpDir, 'project');
      fs.mkdirSync(sub);
      const link = join(sub, 'link.txt');
      fs.symlinkSync(external, link);

      expect(await findSymlinkOnPath(tmpDir, link)).to.equal(link);
    });

    it('should detect a symlinked directory in the path', async () => {
      const externalDir = join(tmpDir, 'external');
      fs.mkdirSync(externalDir);
      const project = join(tmpDir, 'project');
      fs.mkdirSync(project);
      const linkedDir = join(project, 'classes');
      fs.symlinkSync(externalDir, linkedDir);

      const dest = join(linkedDir, 'MyClass.cls');
      expect(await findSymlinkOnPath(tmpDir, dest)).to.equal(linkedDir);
    });

    it('should return undefined when path segments do not exist yet', async () => {
      const dest = join(tmpDir, 'nonexistent', 'deep', 'file.cls');
      expect(await findSymlinkOnPath(tmpDir, dest)).to.be.undefined;
    });

    it('should catch a symlink at the package-dir level when root is the project root', async () => {
      const projectRoot = join(tmpDir, 'myproject');
      fs.mkdirSync(projectRoot);
      const externalDir = join(tmpDir, 'external');
      fs.mkdirSync(join(externalDir, 'main', 'default'), { recursive: true });
      const forceApp = join(projectRoot, 'force-app');
      fs.symlinkSync(externalDir, forceApp);
      const dest = join(forceApp, 'main', 'default', 'MyClass.cls');

      // project root catches it: force-app is a checked segment
      expect(await findSymlinkOnPath(projectRoot, dest)).to.equal(forceApp);
      // package dir as root misses it: force-app IS the root, never checked
      expect(await findSymlinkOnPath(forceApp, dest)).to.be.undefined;
    });
  });

  describe('findSymlinkOnPathSync', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(join(os.tmpdir(), 'sdr-symlink-sync-test-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should return undefined when no symlinks exist', () => {
      const sub = join(tmpDir, 'a', 'b');
      fs.mkdirSync(sub, { recursive: true });
      const dest = join(sub, 'file.cls');
      fs.writeFileSync(dest, 'content');

      expect(findSymlinkOnPathSync(tmpDir, dest)).to.be.undefined;
    });

    it('should detect a symlinked file at the destination', () => {
      const external = join(tmpDir, 'external.txt');
      fs.writeFileSync(external, 'external');
      const sub = join(tmpDir, 'project');
      fs.mkdirSync(sub);
      const link = join(sub, 'link.txt');
      fs.symlinkSync(external, link);

      expect(findSymlinkOnPathSync(tmpDir, link)).to.equal(link);
    });

    it('should detect a symlinked ancestor directory', () => {
      const externalDir = join(tmpDir, 'external');
      fs.mkdirSync(externalDir);
      fs.writeFileSync(join(externalDir, 'victim.txt'), 'important data');
      const project = join(tmpDir, 'project');
      fs.mkdirSync(project);
      const linkedDir = join(project, 'digitalExperiences');
      fs.symlinkSync(externalDir, linkedDir);

      const dest = join(linkedDir, 'victim.txt');
      expect(findSymlinkOnPathSync(tmpDir, dest)).to.equal(linkedDir);
    });

    it('should return undefined when path segments do not exist yet', () => {
      const dest = join(tmpDir, 'nonexistent', 'deep', 'file.cls');
      expect(findSymlinkOnPathSync(tmpDir, dest)).to.be.undefined;
    });

    it('should reject destinations outside the root', () => {
      const projectRoot = join(tmpDir, 'project');
      fs.mkdirSync(projectRoot);
      const outside = join(tmpDir, 'outside', 'file.txt');

      expect(findSymlinkOnPathSync(projectRoot, outside)).to.equal(outside);
    });

    it('should allow cross-package-dir paths when root is the project root', () => {
      const projectRoot = join(tmpDir, 'myproject');
      fs.mkdirSync(join(projectRoot, 'force-app', 'main', 'default'), { recursive: true });
      fs.mkdirSync(join(projectRoot, 'force-app-2', 'main', 'default'), { recursive: true });

      const fileInOtherPkg = join(projectRoot, 'force-app-2', 'main', 'default', 'someFile.txt');
      fs.writeFileSync(fileInOtherPkg, 'content');

      expect(findSymlinkOnPathSync(projectRoot, fileInOtherPkg)).to.be.undefined;
    });

    it('should reject cross-package-dir paths when root is a single package dir', () => {
      const projectRoot = join(tmpDir, 'myproject');
      const pkg1 = join(projectRoot, 'force-app');
      fs.mkdirSync(join(pkg1, 'main', 'default'), { recursive: true });
      fs.mkdirSync(join(projectRoot, 'force-app-2', 'main', 'default'), { recursive: true });

      const fileInOtherPkg = join(projectRoot, 'force-app-2', 'main', 'default', 'someFile.txt');
      fs.writeFileSync(fileInOtherPkg, 'content');

      expect(findSymlinkOnPathSync(pkg1, fileInOtherPkg)).to.equal(fileInOtherPkg);
    });
  });
});
