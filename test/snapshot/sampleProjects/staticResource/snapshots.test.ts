/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileSnap, mdapiToSource, sourceToMdapi } from '../../helper/conversions';

const projectName = 'staticResource';

// eslint-disable-next-line prefer-arrow-callback
describe('staticResource', function () {
  before(async () => {
    const testDir = path.join('test', 'snapshot', 'sampleProjects', projectName);

    const sourceFiles = await mdapiToSource(testDir);
    const mdFiles = await sourceToMdapi(testDir);

    describe(`${projectName} source files`, () => {
      for (const file of sourceFiles) {
        it(`verify ${path.basename(file)}`, async () => {
          await fileSnap(file, testDir);
        });
      }
    });
    describe(`${projectName} md files`, () => {
      for (const file of mdFiles) {
        it(`verify ${path.basename(file)}`, async () => {
          await fileSnap(file, testDir);
        });
      }
    });
    describe('cleanup', () => {
      it('cleanup', async () => {
        await fs.promises.rm(path.join(testDir, 'force-app'), { recursive: true, force: true });
        await fs.promises.rm(path.join(testDir, 'mdapiOutput'), { recursive: true, force: true });
      });
    });
  });
  // this needs to exist to ensure the before() block runs
  it('stub', async () => {});
});
