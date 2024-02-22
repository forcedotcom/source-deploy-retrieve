/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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
const testDir = testOriginalDir.replace(folder, `${folder}Tmp`);
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

  describe.skip('decompose mdapi over existing source is idempotent', () => {
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
      await validateSourceDir(pkgDirs[0]);
      await dirsAreIdentical(
        path.join(testDir, pkgDirs[0]),
        path.join(testDir.replace(tmpFolder, folder), '__snapshots__', pkgNameToTestName(pkgDirs[0]), pkgDirs[0])
      );
    });
    it(`verify ${pkgDirs[2]}`, async () => {
      await validateSourceDir(pkgDirs[0]);
      await dirsAreIdentical(
        path.join(testDir, pkgDirs[0]),
        path.join(testDir.replace(tmpFolder, folder), '__snapshots__', pkgNameToTestName(pkgDirs[0]), pkgDirs[0])
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
    await fileSnap(file, testOriginalDir);
  }
};
