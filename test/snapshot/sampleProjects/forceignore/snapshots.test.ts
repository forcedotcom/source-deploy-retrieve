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
