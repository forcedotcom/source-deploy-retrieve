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
import { dirsAreIdentical, dirEntsToPaths, fileSnap } from '../../helper/conversions';
import { MetadataConverter } from '../../../../src/convert/metadataConverter';
import { ComponentSetBuilder } from '../../../../src/collections/componentSetBuilder';

// we don't want failing tests outputting over each other
/* eslint-disable no-await-in-loop */

describe('Creating and converting ComponentSets with destructive changes', () => {
  const testDir = path.join('test', 'snapshot', 'sampleProjects', 'destructiveCompSets');

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

  it('1 pre-destructive and 1 deployment', async () => {
    const cs = await ComponentSetBuilder.build({
      metadata: {
        metadataEntries: ['ApexClass:OneClass'],
        destructiveEntriesPre: ['ApexClass:RedClass'],
        directoryPaths: [sourceDir],
      },
      projectDir: testDir,
    });

    const pre1TestOutputDir = path.join(testOutput, 'pre1');

    await new MetadataConverter().convert(cs, 'metadata', {
      type: 'directory',
      outputDirectory: pre1TestOutputDir,
      genUniqueDir: false,
    });

    const convertedFiles = await getConvertedFilePaths(pre1TestOutputDir);
    for (const file of convertedFiles) {
      await fileSnap(file, testDir);
    }
    const expectedOutputDir = path.join(
      snapshotsDir,
      '1-pre-destructive-and-1-deployment.expected',
      'testOutput',
      'pre1'
    );
    await dirsAreIdentical(expectedOutputDir, pre1TestOutputDir);
  });

  it('2 pre-destructive and 2 deployments', async () => {
    const cs = await ComponentSetBuilder.build({
      metadata: {
        metadataEntries: ['ApexClass:OneClass', 'ApexClass:TwoClass'],
        destructiveEntriesPre: ['ApexClass:RedClass', 'ApexClass:BlueClass'],
        directoryPaths: [sourceDir],
      },
      projectDir: testDir,
    });

    const pre2TestOutputDir = path.join(testOutput, 'pre2');

    await new MetadataConverter().convert(cs, 'metadata', {
      type: 'directory',
      outputDirectory: pre2TestOutputDir,
      genUniqueDir: false,
    });

    const convertedFiles = await getConvertedFilePaths(pre2TestOutputDir);
    for (const file of convertedFiles) {
      await fileSnap(file, testDir);
    }
    const expectedOutputDir = path.join(
      snapshotsDir,
      '2-pre-destructive-and-2-deployments.expected',
      'testOutput',
      'pre2'
    );
    await dirsAreIdentical(expectedOutputDir, pre2TestOutputDir);
  });

  it('1 post-destructive and 1 deployment', async () => {
    const cs = await ComponentSetBuilder.build({
      metadata: {
        metadataEntries: ['ApexClass:OneClass'],
        destructiveEntriesPost: ['ApexClass:RedClass'],
        directoryPaths: [sourceDir],
      },
      projectDir: testDir,
    });

    const postTestOutputDir = path.join(testOutput, 'post1');

    await new MetadataConverter().convert(cs, 'metadata', {
      type: 'directory',
      outputDirectory: postTestOutputDir,
      genUniqueDir: false,
    });

    const convertedFiles = await getConvertedFilePaths(postTestOutputDir);
    for (const file of convertedFiles) {
      await fileSnap(file, testDir);
    }
    const expectedOutputDir = path.join(
      snapshotsDir,
      '1-post-destructive-and-1-deployment.expected',
      'testOutput',
      'post1'
    );
    await dirsAreIdentical(expectedOutputDir, postTestOutputDir);
  });

  it('2 post-destructive and 2 deployments', async () => {
    const cs = await ComponentSetBuilder.build({
      metadata: {
        metadataEntries: ['ApexClass:OneClass', 'ApexClass:TwoClass'],
        destructiveEntriesPost: ['ApexClass:RedClass', 'ApexClass:BlueClass'],
        directoryPaths: [sourceDir],
      },
      projectDir: testDir,
    });

    const post2TestOutputDir = path.join(testOutput, 'post2');

    await new MetadataConverter().convert(cs, 'metadata', {
      type: 'directory',
      outputDirectory: post2TestOutputDir,
      genUniqueDir: false,
    });

    const convertedFiles = await getConvertedFilePaths(post2TestOutputDir);
    for (const file of convertedFiles) {
      await fileSnap(file, testDir);
    }
    const expectedOutputDir = path.join(
      snapshotsDir,
      '2-post-destructive-and-2-deployments.expected',
      'testOutput',
      'post2'
    );
    await dirsAreIdentical(expectedOutputDir, post2TestOutputDir);
  });

  it('1 post-destructive and no deployment', async () => {
    const cs = await ComponentSetBuilder.build({
      metadata: {
        metadataEntries: [],
        destructiveEntriesPost: ['ApexClass:RedClass'],
        directoryPaths: [sourceDir],
      },
      projectDir: testDir,
    });

    const postTestOutputDir = path.join(testOutput, 'post1-solo');

    await new MetadataConverter().convert(cs, 'metadata', {
      type: 'directory',
      outputDirectory: postTestOutputDir,
      genUniqueDir: false,
    });

    const convertedFiles = await getConvertedFilePaths(postTestOutputDir);
    for (const file of convertedFiles) {
      await fileSnap(file, testDir);
    }
    const expectedOutputDir = path.join(
      snapshotsDir,
      '1-post-destructive-and-no-deployment.expected',
      'testOutput',
      'post1-solo'
    );
    await dirsAreIdentical(expectedOutputDir, postTestOutputDir);
  });

  it('throws when wildcards are used in destructive changes', async () => {
    try {
      await ComponentSetBuilder.build({
        metadata: {
          metadataEntries: ['ApexClass:OneClass'],
          destructiveEntriesPost: ['ApexClass:*'],
          directoryPaths: [sourceDir],
        },
        projectDir: testDir,
      });
      expect(true, 'using a wildcard in destructiveEntriesPost should throw').to.be.false;
    } catch (e) {
      expect(e).to.be.instanceof(Error);
      const err = e as Error;
      expect(err.message).to.include('Wildcards are not supported');
    }
  });

  after(async () => {
    await fs.promises.rm(testOutput, { recursive: true, force: true });
  });
});
