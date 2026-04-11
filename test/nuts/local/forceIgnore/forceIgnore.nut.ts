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
import JSZip from 'jszip';
import { TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { ComponentSet } from '../../../../src';
import { ZipTreeContainer } from '../../../../src/resolve/treeContainers';

const META_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>58.0</apiVersion>
    <status>Active</status>
</ApexClass>`;

describe('ForceIgnore directory patterns (e2e)', () => {
  let session: TestSession;

  before(async () => {
    session = await TestSession.create({
      project: {
        sourceDir: path.join('test', 'nuts', 'local', 'forceIgnore', 'testProj'),
      },
      devhubAuthStrategy: 'NONE',
    });
  });

  after(async () => {
    await session?.clean();
  });

  const writeForceIgnore = (content: string): Promise<void> =>
    fs.promises.writeFile(path.join(session.project.dir, '.forceignore'), content);

  const resolvedFullNames = (): string[] =>
    ComponentSet.fromSource({ fsPaths: [session.project.dir] })
      .getSourceComponents()
      .toArray()
      .map((c) => c.fullName);

  describe('trailing-slash directory patterns', () => {
    it('excludes a directory matching a trailing-slash forceignore pattern', async () => {
      await writeForceIgnore('node_modules/\n');
      const names = resolvedFullNames();
      expect(names).to.include('MyClass');
      // LibHelper lives inside node_modules/some-sfdx-lib/classes/ — should be excluded
      expect(names).to.not.include('LibHelper');
    });

    it('does not exclude a sibling directory whose name only partially matches', async () => {
      await writeForceIgnore('node_modules/\n');
      const names = resolvedFullNames();
      // node_modules_extra/ does not match the node_modules/ pattern
      expect(names).to.include('ExtraClass');
    });

    it('excludes a nested node_modules directory inside the source tree', async () => {
      const nestedDir = path.join(session.project.dir, 'force-app', 'main', 'node_modules', 'classes');
      await fs.promises.mkdir(nestedDir, { recursive: true });
      await fs.promises.writeFile(path.join(nestedDir, 'NestedClass.cls'), 'public class NestedClass {}');
      await fs.promises.writeFile(path.join(nestedDir, 'NestedClass.cls-meta.xml'), META_XML);

      await writeForceIgnore('node_modules/\n');
      const names = resolvedFullNames();
      expect(names).to.include('MyClass');
      expect(names).to.not.include('NestedClass');
    });
  });

  describe('ignore/unignore hierarchy', () => {
    it('traverses unignored subdirectories while stopping at denied ones', async () => {
      // **/internal/** denies all content inside internal/
      // !**/internal/metadata unignores the metadata directory itself so traversal enters it
      // !**/internal/metadata/** unignores everything inside metadata/
      // internal/blocked/ has no negation so traversal stops there
      await writeForceIgnore(['**/internal/**', '!**/internal/metadata', '!**/internal/metadata/**'].join('\n'));
      const names = resolvedFullNames();
      expect(names).to.include('MyClass');
      expect(names).to.include('InternalAllowed');
      expect(names).to.not.include('InternalBlocked');
    });
  });

  describe('virtual tree (zip / PR #1093 scenario)', () => {
    it('denies an unpackaged directory in a zip tree when forceignore contains unpackaged/', async () => {
      await writeForceIgnore('unpackaged/\n');

      const zip = new JSZip();
      zip.folder('unpackaged');
      zip.folder('unpackaged/classes');
      zip.file('unpackaged/classes/ZipClass.cls', 'public class ZipClass {}');
      zip.file('unpackaged/classes/ZipClass.cls-meta.xml', META_XML);
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });
      const tree = await ZipTreeContainer.create(buffer);

      // TestSession already stubs process.cwd() to session.project.dir, so
      // ForceIgnore.findAndCreate('unpackaged') → searchUp uses that stub to
      // resolve the relative path and walk up to find the .forceignore we wrote.
      const cs = ComponentSet.fromSource({ fsPaths: ['unpackaged'], tree });
      expect(cs.getSourceComponents().toArray()).to.have.lengthOf(0);
    });
  });
});
