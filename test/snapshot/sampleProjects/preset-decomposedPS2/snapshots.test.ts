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
import {
  compareTwoXml,
  fileSnap,
  mdapiToSource,
  sourceToMdapi,
  MDAPI_OUT,
  dirsAreIdentical,
} from '../../helper/conversions';

// we don't want failing tests outputting over each other
/* eslint-disable no-await-in-loop */

describe('fully decomposed permission set via decomposePermissionSetBeta2', () => {
  const testDir = path.join('test', 'snapshot', 'sampleProjects', 'preset-decomposedPS2');
  let sourceFiles: string[];
  let mdFiles: string[];

  before(async () => {
    sourceFiles = await mdapiToSource(testDir);
    mdFiles = await sourceToMdapi(testDir);
  });
  it('verify source files', async () => {
    for (const file of sourceFiles) {
      await fileSnap(file, testDir);
    }
    await dirsAreIdentical(
      path.join(testDir, 'force-app'),
      path.join(testDir, '__snapshots__', 'verify-source-files.expected', 'force-app')
    );
  });
  it('verify md files', async () => {
    for (const file of mdFiles) {
      await fileSnap(file, testDir);
    }
  });
  it('round trip of metadata format is equivalent', async () => {
    const [old1, updated1] = await Promise.all([
      fs.promises.readFile(path.join(testDir, 'originalMdapi', 'permissionsets', 'dreamhouse.permissionset'), 'utf8'),
      fs.promises.readFile(path.join(testDir, MDAPI_OUT, 'permissionsets', 'dreamhouse.permissionset'), 'utf8'),
    ]);
    compareTwoXml(old1, updated1);

    const [old2, updated2] = await Promise.all([
      fs.promises.readFile(path.join(testDir, 'originalMdapi', 'permissionsets', 'ebikes.permissionset'), 'utf8'),
      fs.promises.readFile(path.join(testDir, MDAPI_OUT, 'permissionsets', 'ebikes.permissionset'), 'utf8'),
    ]);
    compareTwoXml(old2, updated2);

    const [old3, updated3] = await Promise.all([
      fs.promises.readFile(
        path.join(testDir, 'originalMdapi', 'permissionsets', 'noObjectSettings.permissionset'),
        'utf8'
      ),
      fs.promises.readFile(path.join(testDir, MDAPI_OUT, 'permissionsets', 'noObjectSettings.permissionset'), 'utf8'),
    ]);
    compareTwoXml(old3, updated3);

    const [old4, updated4] = await Promise.all([
      fs.promises.readFile(
        path.join(testDir, 'originalMdapi', 'permissionsets', 'withCustomPermission.permissionset'),
        'utf8'
      ),
      fs.promises.readFile(
        path.join(testDir, MDAPI_OUT, 'permissionsets', 'withCustomPermission.permissionset'),
        'utf8'
      ),
    ]);
    compareTwoXml(old4, updated4);
  });

  after(async () => {
    await Promise.all([
      fs.promises.rm(path.join(testDir, 'force-app'), { recursive: true, force: true }),
      fs.promises.rm(path.join(testDir, MDAPI_OUT), { recursive: true, force: true }),
    ]);
  });
});
