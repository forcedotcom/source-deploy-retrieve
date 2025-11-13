/*
 * Copyright 2025, Salesforce, Inc.
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
import { expect } from 'chai';
import {
  FORCE_APP,
  MDAPI_OUT,
  dirsAreIdentical,
  fileSnap,
  mdapiToSource,
  sourceToMdapi,
} from '../../helper/conversions';
import { ComponentSetBuilder, MetadataConverter, RegistryAccess } from '../../../../src';

// we don't want failing tests outputting over each other
/* eslint-disable no-await-in-loop */

describe('digitalExperienceBundleWithWebapps', () => {
  const testDir = path.join('test', 'snapshot', 'sampleProjects', 'digitalExperienceBundleWithWebapps');
  let sourceFiles: string[];
  let mdFiles: string[];

  before(async () => {
    await fs.promises.mkdir(path.join(testDir, FORCE_APP), { recursive: true });
    sourceFiles = await mdapiToSource(testDir);
    mdFiles = await sourceToMdapi(testDir);
  });
  it('verify source files', async () => {
    for (const file of sourceFiles) {
      await fileSnap(file, testDir);
    }
    await dirsAreIdentical(
      path.join(testDir, FORCE_APP),
      path.join(testDir, '__snapshots__', 'verify-source-files.expected', FORCE_APP)
    );
  });

  it('verifies source files after two conversions', async () => {
    // reads all files in a directory recursively
    function getAllFiles(dirPath: string, fileList: string[] = []): string[] {
      const files = fs.readdirSync(dirPath);

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          getAllFiles(filePath, fileList); // Recursive call for subdirectories
        } else {
          fileList.push(filePath);
        }
      }

      return fileList;
    }

    // should contain correct file path for webapps
    const fileList = getAllFiles(path.join(testDir, FORCE_APP));

    await dirsAreIdentical(
      path.join(testDir, FORCE_APP),
      path.join(testDir, '__snapshots__', 'verify-source-files.expected', FORCE_APP)
    );

    // build a new CS from the freshly-converted source-format metadata
    const cs = await ComponentSetBuilder.build({
      sourcepath: [path.join(testDir, 'originalMdapi')],
      projectDir: testDir,
    });
    const registry = new RegistryAccess(undefined, testDir);
    const converter = new MetadataConverter(registry);

    // converts metadata format DEB into source-format, with a mergeWith option, merging into force-app
    await converter.convert(
      cs,
      'source', // loads custom registry if there is one
      {
        type: 'merge',
        mergeWith: (
          await ComponentSetBuilder.build({
            sourcepath: [path.join(testDir, 'force-app')],
            projectDir: testDir,
          })
        ).getSourceComponents(),
        defaultDirectory: path.join(testDir, 'force-app'),
      }
    );

    // verify the file list is consistent after two conversions
    const fileList2 = getAllFiles(path.join(testDir, FORCE_APP));
    expect(fileList2).to.deep.equal(fileList);

    await dirsAreIdentical(
      path.join(testDir, FORCE_APP),
      path.join(testDir, '__snapshots__', 'verify-source-files.expected', FORCE_APP)
    );
  });
  it('verify md files', async () => {
    for (const file of mdFiles) {
      await fileSnap(file, testDir);
    }
  });

  after(async () => {
    await Promise.all([
      fs.promises.rm(path.join(testDir, FORCE_APP), { recursive: true, force: true }),
      fs.promises.rm(path.join(testDir, MDAPI_OUT), { recursive: true, force: true }),
    ]);
  });
});
