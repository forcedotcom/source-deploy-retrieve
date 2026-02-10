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
import * as fs from 'node:fs';
import * as path from 'node:path';
import { MetadataConverter } from '../../../../src/convert/metadataConverter';
import { dirEntsToPaths, dirsAreIdentical, fileSnap } from '../../helper/conversions';
import { ComponentSetBuilder } from '../../../../src/collections/componentSetBuilder';

// We don't want failing tests outputting over each other
/* eslint-disable no-await-in-loop */

const folder = 'digitalExperienceMobilePages';
const tmpFolder = `${folder}Tmp`;
const testOriginalDir = path.join('test', 'snapshot', 'sampleProjects', folder);
const testDir = testOriginalDir.replace(folder, tmpFolder);
const pkgDir = path.join(testDir, 'force-app');
const augmentedPkgDir = path.join(testDir, 'force-app-destination');

describe('Merge project with `mobile` folder onto one without', () => {
  let files: string[];

  before(async () => {
    // because we're applying changes over the existing source, move it to a new place
    await fs.promises.cp(testOriginalDir, testDir, {
      recursive: true,
      force: true,
      filter: (src) => !src.includes('__snapshots__'),
    });
    // Turn `force-app` into a metadata API style project.
    const cs = await ComponentSetBuilder.build({
      sourcepath: [pkgDir],
      apiversion: '60.0',
    });
    const converter = new MetadataConverter();
    await converter.convert(cs, 'metadata', {
      type: 'directory',
      outputDirectory: path.join(testDir, 'mdapiOutput'),
      genUniqueDir: false,
    });
    files = dirEntsToPaths(
      await fs.promises.readdir(path.join(testDir, 'mdapiOutput'), {
        recursive: true,
        withFileTypes: true,
      })
    );
  });

  after(async () => {
    await fs.promises.rm(testDir, { recursive: true, force: true });
  });

  it('verify files pre-merge', async () => {
    for (const file of files) {
      await fileSnap(file, testOriginalDir);
    }
  });

  describe('merge into destination', () => {
    before(async () => {
      // Build the mdapiOutput folder into a component set.
      const cs = await ComponentSetBuilder.build({
        sourcepath: [path.join(testDir, 'mdapiOutput')],
      });
      // Turn the destination into a component set as well.
      const mergeWith = (
        await ComponentSetBuilder.build({
          sourcepath: [augmentedPkgDir],
        })
      ).getSourceComponents();

      const converter = new MetadataConverter();

      // Merge the origin onto the destination.
      await converter.convert(cs, 'source', {
        type: 'merge',
        mergeWith,
        defaultDirectory: path.resolve(pkgDir),
      });
    });

    it('files are placed properly', async () => {
      // compare the final destination folder to the origin folder; they should be identical
      await dirsAreIdentical(path.join(testDir, 'force-app'), path.join(testDir, 'force-app-destination'));
    });
  });

  describe('', () => {});
});
