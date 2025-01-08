/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  FORCE_APP,
  MDAPI_OUT,
  dirsAreIdentical,
  fileSnap,
  mdapiToSource,
  sourceToMdapi,
} from '../../helper/conversions';

// we don't want failing tests outputting over each other
/* eslint-disable no-await-in-loop */

describe('Custom objects and children', () => {
  const testDir = path.join('test', 'snapshot', 'sampleProjects', 'customObjects-and-children');
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
