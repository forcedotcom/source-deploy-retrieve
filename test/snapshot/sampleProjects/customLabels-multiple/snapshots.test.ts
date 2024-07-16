/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect } from 'chai';
import { dirEntsToPaths, fileSnap, dirsAreIdentical } from '../../helper/conversions';
import { MetadataConverter } from '../../../../src/convert/metadataConverter';
import { ComponentSetBuilder } from '../../../../src/collections/componentSetBuilder';

// we don't want failing tests outputting over each other
/* eslint-disable no-await-in-loop */

describe('Multiple large custom labels files', () => {
  const testDir = path.join('test', 'snapshot', 'sampleProjects', 'customLabels-multiple');

  // The directory containing metadata in source format to be converted
  const sourceDir = path.join(testDir, 'originalSource');

  // The directory of snapshots containing expected conversion results
  const snapshotsDir = path.join(testDir, '__snapshots__');

  // The directory where metadata is converted as part of testing
  const testOutput = path.join(testDir, 'testOutput');

  /** Return only the files involved in the conversion */
  const getConvertedFilePaths = async (outputDir: string): Promise<string[]> =>
    dirEntsToPaths(
      await fs.promises.readdir(outputDir, {
        recursive: true,
        withFileTypes: true,
      })
    );

  // Verifies that multiple, large custom labels files can be converted
  // without running out of memory.  The directory names in the "originalSource"
  // directory are intentionally named "first-app", "second-app", "third-app"
  // to ensure custom labels files are found and converted in a certain order.
  // If running this test causes out of memory crashes it means there was a
  // regression in the conversion code; most likely recompositionFinalizer.
  it('verify source convert', async () => {
    const cs = await ComponentSetBuilder.build({
      sourcepath: [sourceDir],
      projectDir: testDir,
    });
    const convertStartTime = Date.now();
    await new MetadataConverter().convert(cs, 'metadata', {
      type: 'directory',
      outputDirectory: testOutput,
      genUniqueDir: false,
    });
    // Longer than 10 seconds could indicate a regression
    expect(Date.now() - convertStartTime, 'conversion should take less than 10 seconds').to.be.lessThan(10000);

    const convertedFiles = await getConvertedFilePaths(testOutput);
    for (const file of convertedFiles) {
      await fileSnap(file, testDir);
    }
    dirsAreIdentical(path.join(snapshotsDir, 'testOutput'), testOutput);
  });

  after(async () => {
    await fs.promises.rm(testOutput, { recursive: true, force: true });
  });
});
