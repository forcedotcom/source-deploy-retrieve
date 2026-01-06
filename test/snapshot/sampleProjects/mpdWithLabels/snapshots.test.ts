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
import { MetadataConverter } from '../../../../src/convert/metadataConverter';
import { dirEntsToPaths, dirsAreIdentical, fileSnap } from '../../helper/conversions';
import { ComponentSetBuilder } from '../../../../src/collections/componentSetBuilder';

// we don't want failing tests outputting over each other
/* eslint-disable no-await-in-loop */

const folder = 'mpdWithLabels';
const tmpFolder = `${folder}Tmp`;
const testOriginalDir = path.join('test', 'snapshot', 'sampleProjects', folder);
const testDir = testOriginalDir.replace(folder, tmpFolder);
const pkgDirs = ['force-app', 'my-app', path.join('foo-bar', 'app')];
const resolvedPkgDirs = pkgDirs.map((d) => path.join(testDir, d));

describe('recompose/decompose mpd project with labels', () => {
  let mdFiles: string[];

  before(async () => {
    // because we're applying changes over the existing source, move it to a new place
    await fs.promises.cp(testOriginalDir, testDir, {
      recursive: true,
      force: true,
      filter: (src) => !src.includes('__snapshots__'),
    });
    const cs = await ComponentSetBuilder.build({
      sourcepath: resolvedPkgDirs,
      apiversion: '60.0',
    });
    const converter = new MetadataConverter();
    await converter.convert(cs, 'metadata', {
      type: 'directory',
      outputDirectory: path.join(testDir, 'mdapiOutput'),
      genUniqueDir: false,
    });
    mdFiles = dirEntsToPaths(
      await fs.promises.readdir(path.join(testDir, 'mdapiOutput'), {
        recursive: true,
        withFileTypes: true,
      })
    );
  });

  it('verify md files after recomposing', async () => {
    for (const file of mdFiles) {
      await fileSnap(file, testOriginalDir);
    }
  });

  describe('decompose mdapi over existing source is idempotent', () => {
    before(async () => {
      // SDR should match the original source
      const cs = await ComponentSetBuilder.build({
        sourcepath: [path.join(testDir, 'mdapiOutput')],
      });
      // a CS from the destination
      const mergeWith = (
        await ComponentSetBuilder.build({
          sourcepath: resolvedPkgDirs,
        })
      ).getSourceComponents();

      const converter = new MetadataConverter();

      await converter.convert(cs, 'source', {
        type: 'merge',
        mergeWith,
        defaultDirectory: path.resolve(resolvedPkgDirs[0]),
      });
    });

    // painfully repetitive, but the async nature makes dynamic testing even uglier
    it(`verify ${pkgDirs[0]}`, async () => {
      await validateSourceDir(pkgDirs[0]);
      await dirsAreIdentical(
        path.join(testDir, pkgDirs[0]),
        path.join(testDir.replace(tmpFolder, folder), '__snapshots__', pkgNameToTestName(pkgDirs[0]), pkgDirs[0])
      );
    });
    it(`verify ${pkgDirs[1]}`, async () => {
      await validateSourceDir(pkgDirs[1]);
      await dirsAreIdentical(
        path.join(testDir, pkgDirs[1]),
        path.join(testDir.replace(tmpFolder, folder), '__snapshots__', pkgNameToTestName(pkgDirs[1]), pkgDirs[1])
      );
    });
    it(`verify ${pkgDirs[2]}`, async () => {
      await validateSourceDir(pkgDirs[2]);
      await dirsAreIdentical(
        path.join(testDir, pkgDirs[2]),
        path.join(testDir.replace(tmpFolder, folder), '__snapshots__', pkgNameToTestName(pkgDirs[2]), pkgDirs[2])
      );
    });
  });

  after(async () => {
    await Promise.all([fs.promises.rm(testDir, { recursive: true, force: true })]);
  });
});

// snapshot dirs convert spaces and slashes to dashes
const pkgNameToTestName = (pkgName: string) => `verify-${pkgName.split(path.sep).join('-')}.expected`;

const validateSourceDir = async (dir: string): Promise<void> => {
  const sourceFiles = dirEntsToPaths(
    await fs.promises.readdir(path.join(testDir, dir), {
      recursive: true,
      withFileTypes: true,
    })
  );
  for (const file of sourceFiles) {
    await fileSnap(file, testOriginalDir, testDir);
  }
};
