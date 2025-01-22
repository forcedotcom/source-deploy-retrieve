/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { dirsAreIdentical, dirEntsToPaths, fileSnap } from '../../helper/conversions';
import { MetadataConverter } from '../../../../src/convert/metadataConverter';
import { ComponentSetBuilder } from '../../../../src/collections/componentSetBuilder';

// we don't want failing tests outputting over each other
/* eslint-disable no-await-in-loop */

describe('will respect forceignore when resolving from metadata ', () => {
  const testDir = path.join('test', 'snapshot', 'sampleProjects', 'forceignore');

  // The directory containing metadata in source format to be converted
  const mdapiDir = path.join(testDir, 'originalMdapi');

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

  it('ignores source format path', async () => {
    const cs = await ComponentSetBuilder.build({
      metadata: {
        metadataEntries: ['ApexClass:OneClass', 'Profile:Admin'],
        directoryPaths: [mdapiDir],
      },
      projectDir: testDir,
    });

    const sourceOutput = path.join(testOutput, 'source-format');

    await new MetadataConverter().convert(cs, 'source', {
      type: 'directory',
      outputDirectory: sourceOutput,
      genUniqueDir: false,
    });

    const convertedFiles = await getConvertedFilePaths(sourceOutput);
    for (const file of convertedFiles) {
      await fileSnap(file, testDir);
    }
    dirsAreIdentical(path.join(snapshotsDir, 'testOutput', 'source-format'), sourceOutput);
  });

  after(async () => {
    await fs.promises.rm(testOutput, { recursive: true, force: true });
  });
});
