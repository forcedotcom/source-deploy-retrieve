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
import { expect } from 'chai';
import { dirEntsToPaths, fileSnap, dirsAreIdentical } from '../../helper/conversions';
import { MetadataConverter } from '../../../../src/convert/metadataConverter';
import { ComponentSetBuilder } from '../../../../src/collections/componentSetBuilder';

/* eslint-disable no-await-in-loop */

describe('Custom labels merged from non-identical packages', () => {
  const testDir = path.join('test', 'snapshot', 'sampleProjects', 'customLabels-merged');
  const sourceDir = path.join(testDir, 'originalSource');
  const snapshotsDir = path.join(testDir, '__snapshots__');
  const testOutput = path.join(testDir, 'testOutput');

  const getConvertedFilePaths = async (outputDir: string): Promise<string[]> =>
    dirEntsToPaths(
      await fs.promises.readdir(outputDir, {
        recursive: true,
        withFileTypes: true,
      })
    );

  // Verifies that labels from multiple non-identical packages are correctly
  // merged: shared labels are deduplicated, unique labels from each package
  // are preserved, and first-encountered definition wins on conflicts.
  //
  // pkg1: OnlyInPkg1_Alpha, OnlyInPkg1_Beta
  // pkg2: SharedLabel_One, SharedLabel_Two, OnlyInPkg2_Gamma, OnlyInPkg2_Delta
  // pkg3: SharedLabel_One, SharedLabel_Two (different content!), OnlyInPkg3_Epsilon, OnlyInPkg3_Zeta
  //
  // Expected output: 8 unique labels. SharedLabel_One and SharedLabel_Two appear
  // only once (pkg2's version wins since it's encountered first).
  it('verify source convert', async () => {
    const cs = await ComponentSetBuilder.build({
      sourcepath: [sourceDir],
      projectDir: testDir,
    });
    await new MetadataConverter().convert(cs, 'metadata', {
      type: 'directory',
      outputDirectory: testOutput,
      genUniqueDir: false,
    });

    const convertedFiles = await getConvertedFilePaths(testOutput);
    for (const file of convertedFiles) {
      await fileSnap(file, testDir);
    }
    await dirsAreIdentical(path.join(snapshotsDir, 'verify-source-convert.expected', 'testOutput'), testOutput);

    // Verify the merged file has exactly 8 labels (no duplicates)
    const labelsFile = await fs.promises.readFile(path.join(testOutput, 'labels', 'CustomLabels.labels'), 'utf8');
    const fullNameMatches = labelsFile.match(/<fullName>/g);
    expect(fullNameMatches, 'should have exactly 8 unique labels').to.have.lengthOf(8);
  });

  after(async () => {
    await fs.promises.rm(testOutput, { recursive: true, force: true });
  });
});
