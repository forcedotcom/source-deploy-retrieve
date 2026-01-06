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
  FORCE_APP,
  MDAPI_OUT,
  dirEntsToPaths,
  dirsAreIdentical,
  fileSnap,
  mdapiToSource,
  sourceToMdapi,
} from '../../helper/conversions';
import { MetadataConverter } from '../../../../src/convert/metadataConverter';
import { ComponentSetBuilder } from '../../../../src/collections/componentSetBuilder';

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

/** Return only the files involved in the conversion */
const getConvertedFilePaths = async (outputDir: string): Promise<string[]> =>
  dirEntsToPaths(
    await fs.promises.readdir(outputDir, {
      recursive: true,
      withFileTypes: true,
    })
  );

describe('CustomField with empty CustomObject - retrieve', () => {
  const testDir = path.join('test', 'snapshot', 'sampleProjects', 'customObjects-and-children');

  // The directory of snapshots containing expected conversion results
  const snapshotsDir = path.join(testDir, '__snapshots__');

  // MDAPI format of the original source
  const sourceDir = path.join(testDir, 'originalMdapi2');

  // The directory where metadata is converted as part of retrieve testing
  const retrieveOutput = path.join(testDir, 'retrieveOutput');

  // This test verifies that 1 custom field with an empty parent
  // does not omit the parent from the package manifest for a retrieve when
  // converting from source to mdapi.
  it('verify md files retrieve', async () => {
    const cs = await ComponentSetBuilder.build({
      metadata: {
        metadataEntries: ['CustomObject:Broker__c'],
        directoryPaths: [sourceDir],
      },
      projectDir: testDir,
    });

    const sourceOutputDir = path.join(retrieveOutput, 'source');
    const mdOutputDir = path.join(retrieveOutput, 'mdapi');

    await new MetadataConverter().convert(cs, 'source', {
      type: 'directory',
      outputDirectory: sourceOutputDir,
      genUniqueDir: false,
    });

    const cs2 = await ComponentSetBuilder.build({
      metadata: {
        metadataEntries: ['CustomObject:Broker__c'],
        directoryPaths: [sourceOutputDir],
      },
      projectDir: testDir,
    });

    // @ts-expect-error modifying private property
    cs2.forRetrieve = true;

    await new MetadataConverter().convert(cs2, 'metadata', {
      type: 'directory',
      outputDirectory: mdOutputDir,
      genUniqueDir: false,
    });

    const convertedFiles = await getConvertedFilePaths(mdOutputDir);
    for (const file of convertedFiles) {
      await fileSnap(file, testDir);
    }
    const expectedOutputDir = path.join(snapshotsDir, 'verify-md-files-retrieve.expected', 'retrieveOutput', 'mdapi');
    await dirsAreIdentical(expectedOutputDir, mdOutputDir);
  });

  after(async () => {
    await Promise.all([fs.promises.rm(retrieveOutput, { recursive: true, force: true })]);
  });
});

describe('CustomField with empty CustomObject - deploy', () => {
  const testDir = path.join('test', 'snapshot', 'sampleProjects', 'customObjects-and-children');

  // The directory of snapshots containing expected conversion results
  const snapshotsDir = path.join(testDir, '__snapshots__');

  // MDAPI format of the original source
  const sourceDir = path.join(testDir, 'originalMdapi2');

  // The directory where metadata is converted as part of deploy testing
  const deployOutput = path.join(testDir, 'deployOutput');

  // This test verifies that 1 custom field with an empty parent
  // omits the parent from the package manifest for a deploy when
  // converting from source to mdapi.
  it('verify md files deploy', async () => {
    const cs = await ComponentSetBuilder.build({
      metadata: {
        metadataEntries: ['CustomObject:Broker__c'],
        directoryPaths: [sourceDir],
      },
      projectDir: testDir,
    });

    const sourceOutputDir = path.join(deployOutput, 'source');
    const mdOutputDir = path.join(deployOutput, 'mdapi');

    await new MetadataConverter().convert(cs, 'source', {
      type: 'directory',
      outputDirectory: sourceOutputDir,
      genUniqueDir: false,
    });

    const cs2 = await ComponentSetBuilder.build({
      metadata: {
        metadataEntries: ['CustomObject:Broker__c'],
        directoryPaths: [sourceOutputDir],
      },
      projectDir: testDir,
    });

    // @ts-expect-error modifying private property
    cs2.forDeploy = true;

    await new MetadataConverter().convert(cs2, 'metadata', {
      type: 'directory',
      outputDirectory: mdOutputDir,
      genUniqueDir: false,
    });

    const convertedFiles = await getConvertedFilePaths(mdOutputDir);
    for (const file of convertedFiles) {
      await fileSnap(file, testDir);
    }
    const expectedOutputDir = path.join(snapshotsDir, 'verify-md-files-deploy.expected', 'deployOutput', 'mdapi');
    await dirsAreIdentical(expectedOutputDir, mdOutputDir);
  });

  after(async () => {
    await Promise.all([fs.promises.rm(deployOutput, { recursive: true, force: true })]);
  });
});
