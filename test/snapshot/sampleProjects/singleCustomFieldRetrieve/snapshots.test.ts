/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ComponentSetBuilder, MetadataConverter } from 'src';
import { FORCE_APP, MDAPI_OUT, fileSnap, dirEntsToPaths } from '../../helper/conversions';

// we don't want failing tests outputting over each other
/* eslint-disable no-await-in-loop */

const folder = 'singleCustomFieldRetrieve';
// const tmpFolder = `${folder}Tmp`;
const testOriginalDir = path.join('test', 'snapshot', 'sampleProjects', folder);
const testDir = testOriginalDir.replace(folder, `${folder}Tmp`);

/**
 * retrieving a single field retrieves the object, removes the field from it, and leaves a blank object.
 * That blank object should NOT overwrite the existing object if it exists in the merge target
 */
describe('a single field in a CustomObject xml does not overwrite (blank) the existing Object', () => {
  const testDir = path.join('test', 'snapshot', 'sampleProjects', 'singleCustomFieldRetrieve');

  before(async () => {
    // because we're applying changes over the existing source, move it to a new place
    await fs.promises.cp(testOriginalDir, testDir, {
      recursive: true,
      force: true,
      filter: (src) => !src.includes('__snapshots__'),
    });
  });
  it('merge a single retrieved CustomField (Email__c) into project', async () => {
    // SDR should match the original source
    const cs = await ComponentSetBuilder.build({
      sourcepath: [path.join(testDir, MDAPI_OUT)],
    });
    // a CS from the destination
    const mergeWith = (
      await ComponentSetBuilder.build({
        sourcepath: [FORCE_APP],
      })
    ).getSourceComponents();

    const converter = new MetadataConverter();

    await converter.convert(cs, 'source', {
      type: 'merge',
      mergeWith,
      defaultDirectory: path.resolve(FORCE_APP),
    });
  });

  it(`verify ${FORCE_APP}`, async () => {
    await validateSourceDir(FORCE_APP);
  });

  after(async () => {
    await Promise.all([
      fs.promises.rm(path.join(testDir, FORCE_APP), { recursive: true, force: true }),
      fs.promises.rm(path.join(testDir, MDAPI_OUT), { recursive: true, force: true }),
    ]);
  });
});

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
