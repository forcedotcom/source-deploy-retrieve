/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { MDAPI_OUT, fileSnap, sourceToMdapi } from '../../helper/conversions';

// we don't want failing tests outputting over each other
/* eslint-disable no-await-in-loop */

describe('legacy suffix support (.indexe for bigObject index)', () => {
  const testDir = path.join('test', 'snapshot', 'sampleProjects', 'legacySuffixSupport');
  let mdFiles: string[];

  before(async () => {
    mdFiles = await sourceToMdapi(testDir);
  });

  it('verify md files', async () => {
    for (const file of mdFiles) {
      await fileSnap(file, testDir);
    }
  });

  after(async () => {
    await Promise.all([fs.promises.rm(path.join(testDir, MDAPI_OUT), { recursive: true, force: true })]);
  });
});
