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

describe('fully decomposed external service registration via decomposeExternalServiceRegistrationBeta', () => {
  const testDir = path.join('test', 'snapshot', 'sampleProjects', 'preset-decomposedESR');
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
    await dirsAreIdentical(
      path.join(testDir, 'mdapiOutput'),
      path.join(testDir, '__snapshots__', 'verify-md-files.expected')
    );
  });
  it('round trip of metadata format is equivalent', async () => {
    const [old1, updated1] = await Promise.all([
      fs.promises.readFile(
        path.join(
          testDir,
          'originalMdapi',
          'externalServiceRegistrations',
          'OpenAPIChallenge.externalServiceRegistration'
        ),
        'utf8'
      ),
      fs.promises.readFile(
        path.join(testDir, MDAPI_OUT, 'externalServiceRegistrations', 'OpenAPIChallenge.externalServiceRegistration'),
        'utf8'
      ),
    ]);
    compareTwoXml(old1, updated1);
  });

  after(async () => {
    await Promise.all([
      fs.promises.rm(path.join(testDir, 'force-app'), { recursive: true, force: true }),
      fs.promises.rm(path.join(testDir, MDAPI_OUT), { recursive: true, force: true }),
    ]);
  });
});
