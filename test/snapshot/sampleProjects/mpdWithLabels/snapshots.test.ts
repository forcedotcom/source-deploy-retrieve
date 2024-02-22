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

const join = (parent: string) => (file: string) => path.join(parent, file);

describe('recompose/decompose mpd project with labels', () => {
  const testDir = path.join('test', 'snapshot', 'sampleProjects', 'mpdWithLabels');
  const pkgDirs = ['force-app', 'my-app', path.join('foo-bar', 'app')];
  const resolvedPkgDirs = pkgDirs.map(join(testDir));
  let mdFiles: string[];

  before(async () => {
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
      await fileSnap(file, testDir);
    }
  });

  describe('decompose mdapi over existing source is idempotent', () => {
    before(async () => {
      // SDR should match the original source
      const cs = await ComponentSetBuilder.build({
        sourcepath: [path.join(testDir, 'mdapiOutput')],
      });
      const converter = new MetadataConverter();

      await converter.convert(cs, 'source', {
        type: 'directory',
        outputDirectory: path.resolve(testDir),
        genUniqueDir: false,
      });
    });

    pkgDirs.map((pkgDir) => {
      it(`verify ${pkgDir}`, async () => {
        await validateSourceDir(pkgNameToTestName(pkgDir))(testDir)(pkgDir);
      });
    });
  });

  after(async () => {
    await Promise.all([fs.promises.rm(path.join(testDir, 'mdapiOutput'), { recursive: true, force: true })]);
  });
});

// snapshot dirs convert spaces and slashes to dashes
const pkgNameToTestName = (pkgName: string) => `verify-${pkgName.split(path.sep).join('-')}.expected`;

const validateSourceDir =
  (snapshotDir: string) =>
  (testDir: string) =>
  async (dir: string): Promise<void> => {
    const sourceFiles = dirEntsToPaths(
      await fs.promises.readdir(path.join(testDir, dir), {
        recursive: true,
        withFileTypes: true,
      })
    );
    for (const file of sourceFiles) {
      await fileSnap(file, testDir);
    }
    dirsAreIdentical(join(testDir)(dir), join(testDir)(path.join('__snapshots__', snapshotDir, dir)));
  };
