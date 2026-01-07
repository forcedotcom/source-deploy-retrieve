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
  dirsAreIdentical,
  dirEntsToPaths,
  fileSnap,
  mdapiToSource,
  sourceToMdapi,
} from '../../helper/conversions';
import { MetadataConverter } from '../../../../src/convert/metadataConverter';
import { ComponentSetBuilder } from '../../../../src/collections/componentSetBuilder';

// we don't want failing tests outputting over each other
/* eslint-disable no-await-in-loop */

describe('Sharing Rules', () => {
  const testDir = path.join('test', 'snapshot', 'sampleProjects', 'sharingRules');

  // The directory of snapshots containing expected conversion results
  const snapshotsDir = path.join(testDir, '__snapshots__');

  /** Return only the files involved in the conversion */
  const getConvertedFilePaths = async (outputDir: string): Promise<string[]> =>
    dirEntsToPaths(
      await fs.promises.readdir(outputDir, {
        recursive: true,
        withFileTypes: true,
      })
    );

  describe('convert entire project by path', () => {
    let sourceFiles: string[];
    let mdFiles: string[];

    before(async () => {
      sourceFiles = await mdapiToSource(testDir);
      mdFiles = await sourceToMdapi(testDir);
    });
    after(async () => {
      await Promise.all([
        fs.promises.rm(path.join(testDir, FORCE_APP), { recursive: true, force: true }),
        fs.promises.rm(path.join(testDir, MDAPI_OUT), { recursive: true, force: true }),
      ]);
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
  });

  describe('convert SharingRules by SharingCriteriaRule type', () => {
    afterEach(async () => {
      await Promise.all([
        fs.promises.rm(path.join(testDir, FORCE_APP), { recursive: true, force: true }),
        fs.promises.rm(path.join(testDir, MDAPI_OUT), { recursive: true, force: true }),
      ]);
    });
    it('verify source files SCR', async () => {
      // Use expected md files as the project to convert to source format
      const projectMdDir = path.join(snapshotsDir, 'verify-md-files.expected');
      const cs = await ComponentSetBuilder.build({
        metadata: {
          metadataEntries: ['SharingCriteriaRule:account.AcctCBS_toAllInternal'],
          directoryPaths: [projectMdDir],
        },
        projectDir: testDir,
      });
      const convertOutputDir = path.join(testDir, FORCE_APP);
      await new MetadataConverter().convert(cs, 'source', {
        type: 'directory',
        outputDirectory: convertOutputDir,
        genUniqueDir: false,
      });
      const convertedFiles = await getConvertedFilePaths(convertOutputDir);
      for (const file of convertedFiles) {
        await fileSnap(file, testDir);
      }
      const expectedConvertDir = path.join(snapshotsDir, 'verify-source-files-SCR.expected', 'force-app');
      await dirsAreIdentical(convertOutputDir, expectedConvertDir);
    });
    it('verify md files SCR', async () => {
      // Use expected source files as the project to convert to mdapi format
      const projectSrcDir = path.join(snapshotsDir, 'verify-source-files.expected', 'force-app');
      const cs = await ComponentSetBuilder.build({
        metadata: {
          metadataEntries: ['SharingCriteriaRule:account.AcctCBS_toAllInternal'],
          directoryPaths: [projectSrcDir],
        },
        projectDir: testDir,
      });
      const convertOutputDir = path.join(testDir, MDAPI_OUT);
      await new MetadataConverter().convert(cs, 'metadata', {
        type: 'directory',
        outputDirectory: convertOutputDir,
        genUniqueDir: false,
      });

      const convertedFiles = await getConvertedFilePaths(convertOutputDir);
      for (const file of convertedFiles) {
        await fileSnap(file, testDir);
      }
      const expectedConvertDir = path.join(snapshotsDir, 'verify-md-files-SCR.expected');
      await dirsAreIdentical(convertOutputDir, expectedConvertDir);
    });
  });

  describe('convert SharingRules by SharingRules type', () => {
    afterEach(async () => {
      await Promise.all([
        fs.promises.rm(path.join(testDir, FORCE_APP), { recursive: true, force: true }),
        fs.promises.rm(path.join(testDir, MDAPI_OUT), { recursive: true, force: true }),
      ]);
    });
    it('verify source files SR', async () => {
      // Use expected md files as the project to convert to source format
      const projectMdDir = path.join(snapshotsDir, 'verify-md-files.expected');
      const cs = await ComponentSetBuilder.build({
        metadata: {
          metadataEntries: ['SharingRules:account'],
          directoryPaths: [projectMdDir],
        },
        projectDir: testDir,
      });
      const convertOutputDir = path.join(testDir, FORCE_APP);
      await new MetadataConverter().convert(cs, 'source', {
        type: 'directory',
        outputDirectory: convertOutputDir,
        genUniqueDir: false,
      });
      const convertedFiles = await getConvertedFilePaths(convertOutputDir);
      for (const file of convertedFiles) {
        await fileSnap(file, testDir);
      }
      const expectedConvertDir = path.join(snapshotsDir, 'verify-source-files-SR.expected', 'force-app');
      await dirsAreIdentical(convertOutputDir, expectedConvertDir);
    });
    it('verify md files SR', async () => {
      // Use expected source files as the project to convert to mdapi format
      const projectSrcDir = path.join(snapshotsDir, 'verify-source-files.expected', 'force-app');
      const cs = await ComponentSetBuilder.build({
        metadata: {
          metadataEntries: ['SharingRules:account'],
          directoryPaths: [projectSrcDir],
        },
        projectDir: testDir,
      });
      const convertOutputDir = path.join(testDir, MDAPI_OUT);
      await new MetadataConverter().convert(cs, 'metadata', {
        type: 'directory',
        outputDirectory: convertOutputDir,
        genUniqueDir: false,
      });

      const convertedFiles = await getConvertedFilePaths(convertOutputDir);
      for (const file of convertedFiles) {
        await fileSnap(file, testDir);
      }
      const expectedConvertDir = path.join(snapshotsDir, 'verify-md-files-SR.expected');
      await dirsAreIdentical(convertOutputDir, expectedConvertDir);
    });
  });
});
