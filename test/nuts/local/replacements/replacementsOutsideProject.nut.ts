/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as JSZip from 'jszip';
import { TestSession } from '@salesforce/cli-plugins-testkit';
import { assert, expect, config } from 'chai';
import { logFn } from '@salesforce/kit';
import { ComponentSetBuilder, MetadataConverter } from '../../../../src';
import { extractZip } from './extractZip';

config.truncateThreshold = 0;

describe('replacements from outside a proj ', () => {
  let session: TestSession;
  let testDir: string;

  before(async () => {
    session = await TestSession.create({
      project: {
        name: 'replacementsOutsideProject',
        sourceDir: path.join('test', 'nuts', 'local', 'replacements', 'testProj'),
      },
      devhubAuthStrategy: 'NONE',
    });

    // then move the project to a new location
    testDir = path.join(session.dir, 'testDir');
    await fs.promises.cp(session.project.dir, testDir, { recursive: true });
    await fs.promises.rm(session.project.dir, { recursive: true });

    // Hack: rewrite the file replacement locations relative to the moved project
    const projectJsonPath = path.join(testDir, 'sfdx-project.json');
    logFn(`projectJsonPath: ${projectJsonPath}`);
    const original = await fs.promises.readFile(projectJsonPath, 'utf8');
    await fs.promises.writeFile(projectJsonPath, original);
  });

  after(async () => {
    await session?.clean();
  });

  describe('various types of replacements', () => {
    it('converts a componentSet built from the testProj to a zip', async () => {
      process.env.THE_REPLACEMENT = 'foo';
      const converter = new MetadataConverter();
      const cs = await ComponentSetBuilder.build({
        sourcepath: [path.join(testDir, 'force-app')],
        projectDir: testDir,
      });
      const { zipBuffer } = await converter.convert(cs, 'metadata', {
        type: 'zip',
      });
      assert(zipBuffer, 'zipBuffer should be defined');
      // extract zip files
      await extractZip(zipBuffer, path.join(testDir, 'unzipped'));
    });

    it('class replacements as expected', async () => {
      const classContents = await fs.promises.readFile(
        path.join(testDir, 'unzipped', 'classes', 'replaceStuff.cls'),
        'utf8'
      );
      expect(classContents).to.not.include('replaceMeWithEnv');
      expect(classContents).to.not.include('replaceMeWithFile');
      expect(classContents).to.not.include('replaceEachOfTheseValuesWithAValueFromTheEnvUsingRegex');
      expect(classContents).to.include('foo');
      expect(classContents).to.include(
        (await fs.promises.readFile(path.join(testDir, 'replacements.txt'), 'utf8')).trim()
      );
      expect(classContents).to.include('foo');

      expect(classContents).to.include('doNotReplaceThis');
      expect(classContents).to.not.include('conditionallyReplaceThis');
    });
    it('decomposed object replacements as expected', async () => {
      const objectContents = await fs.promises.readFile(
        path.join(testDir, 'unzipped', 'objects', 'TestObj__c.object'),
        'utf8'
      );
      expect(objectContents).to.not.include('placeholder');
      expect(objectContents).to.include('foo');
      expect(objectContents).to.include((await fs.promises.readFile(path.join(testDir, 'label.txt'), 'utf8')).trim());
    });
    it('static resource object replacements as expected', async () => {
      const srZipPath = path.join(testDir, 'unzipped', 'staticresources', 'Test.resource');
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
