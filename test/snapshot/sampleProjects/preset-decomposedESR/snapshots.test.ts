/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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
      path.join(testDir, 'force-app'),
      path.join(testDir, '__snapshots__', 'verify-md-files.expected', 'force-app')
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
      // fs.promises.rm(path.join(testDir, 'force-app'), { recursive: true, force: true }),
      // fs.promises.rm(path.join(testDir, MDAPI_OUT), { recursive: true, force: true }),
    ]);
  });
});
