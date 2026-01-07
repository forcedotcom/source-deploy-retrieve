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
import { assert, expect } from 'chai';
import { ComponentSetBuilder, MetadataConverter } from '../../../../src';
import { extractZip } from './extractZip';

describe('e2e replacements test (customLabels)', () => {
  let session: TestSession;

  before(async () => {
    session = await TestSession.create({
      project: {
        sourceDir: path.join('test', 'nuts', 'local', 'replacements', 'testProjWithLabels'),
      },
      devhubAuthStrategy: 'NONE',
    });
    // Hack: rewrite the file replacement locations relative to the project
    const projectJsonPath = path.join(session.project.dir, 'sfdx-project.json');
    const original = await fs.promises.readFile(projectJsonPath, 'utf8');
    await fs.promises.writeFile(projectJsonPath, original);
  });

  after(async () => {
    await session?.clean();
  });

  describe('various types of replacements', () => {
    it('converts a componentSet built from the testProj to a zip', async () => {
      process.env.THE_REPLACEMENT = 'foo';
      process.env.LABEL_REPLACEMENT = 'REPLACED_LABEL';
      const converter = new MetadataConverter();
      const cs = await ComponentSetBuilder.build({ sourcepath: [path.join(session.project.dir, 'force-app')] });
      const { zipBuffer } = await converter.convert(cs, 'metadata', {
        type: 'zip',
      });
      assert(zipBuffer, 'zipBuffer should be defined');
      // extract zip files
      await extractZip(zipBuffer, path.join(session.project.dir, 'unzipped'));
    });

    it('label replacements as expected (CustomLabels)', async () => {
      const labelsContents = await fs.promises.readFile(
        path.join(session.project.dir, 'unzipped', 'labels', 'CustomLabels.labels'),
        'utf8'
      );
      expect(labelsContents).to.not.include('original');
      expect(labelsContents).to.include('REPLACED_LABEL');
    });

    it('label replacements as expected (CustomLabel)', async () => {
      const converter = new MetadataConverter();
      const cs = await ComponentSetBuilder.build({
        metadata: {
          metadataEntries: ['CustomLabel:Docs_CabinetId'],
          directoryPaths: [path.join(session.project.dir, 'force-app')],
        },
      });
      const { zipBuffer } = await converter.convert(cs, 'metadata', {
        type: 'zip',
      });
      assert(zipBuffer, 'zipBuffer should be defined');
      // extract zip files
      await extractZip(zipBuffer, path.join(session.project.dir, 'unzipped2'));
      const labelsContents = await fs.promises.readFile(
        path.join(session.project.dir, 'unzipped2', 'labels', 'CustomLabels.labels'),
        'utf8'
      );
      expect(labelsContents).to.not.include('original');
      expect(labelsContents).to.include('REPLACED_LABEL');
    });

    it('class replacements as expected', async () => {
      const classContents = await fs.promises.readFile(
        path.join(session.project.dir, 'unzipped', 'classes', 'replaceStuff.cls'),
        'utf8'
      );
      expect(classContents).to.not.include('replaceMeWithEnv');
      expect(classContents).to.not.include('replaceMeWithFile');
      expect(classContents).to.not.include('replaceEachOfTheseValuesWithAValueFromTheEnvUsingRegex');
      expect(classContents).to.include('foo');
      expect(classContents).to.include(
        (await fs.promises.readFile(path.join(session.project.dir, 'replacements.txt'), 'utf8')).trim()
      );
      expect(classContents).to.include('foo');

      expect(classContents).to.include('doNotReplaceThis');
      expect(classContents).to.not.include('conditionallyReplaceThis');
    });
    it('decomposed object replacements as expected', async () => {
      const objectContents = await fs.promises.readFile(
        path.join(session.project.dir, 'unzipped', 'objects', 'TestObj__c.object'),
        'utf8'
      );
      expect(objectContents).to.not.include('placeholder');
      expect(objectContents).to.include('foo');
      expect(objectContents).to.include(
        (await fs.promises.readFile(path.join(session.project.dir, 'label.txt'), 'utf8')).trim()
      );
    });
    it('static resource object replacements as expected', async () => {
      const srZipPath = path.join(session.project.dir, 'unzipped', 'staticresources', 'Test.resource');
      expect(fs.existsSync(srZipPath)).to.be.true;
      const srZip = await JSZip.loadAsync(fs.readFileSync(srZipPath));

      // static resource zip should have 2 files and a dir:
      // 1. "folder/", 2. "folder/test2.css", 3. "folder/test.css"
      expect(Object.entries(srZip.files).length).to.equal(3);

      // Content of the 2 css files should have "foo", not "placeholder" (i.e., replaced)
      for (const filePath of Object.keys(srZip.files)) {
        const zipObj = srZip.file(filePath);
        if (zipObj && !zipObj.dir) {
          // eslint-disable-next-line no-await-in-loop
          const content = await zipObj.async('nodebuffer');
          const contentAsString = content.toString();
          expect(contentAsString).to.not.include('placeholder');
          expect(contentAsString).to.include('foo');
        }
      }
    });
  });
});
