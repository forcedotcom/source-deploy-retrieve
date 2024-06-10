/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fnJoin } from '../../../../src/utils/path';
import { MetadataConverter } from '../../../../src/convert/metadataConverter';
import { RegistryAccess } from '../../../../src/registry/registryAccess';
import { ComponentSetBuilder } from '../../../../src/collections/componentSetBuilder';
import { MDAPI_OUT, dirEntsToPaths, fileSnap } from '../../helper/conversions';

// we don't want failing tests outputting over each other
/* eslint-disable no-await-in-loop */

describe('decomposed Workflow and children (via preset)', () => {
  const testDir = path.join('test', 'snapshot', 'sampleProjects', 'preset-workflow-mpd');
  let mdFiles: string[];

  before(async () => {
    mdFiles = await mdapiConvertMultipleDirs(testDir, ['force-app', 'another-package']);
  });

  it('verify md files', async () => {
    for (const file of mdFiles) {
      await fileSnap(file, testDir);
    }
  });

  after(async () => {
    await Promise.all([fs.promises.rm(path.join(testDir, MDAPI_OUT), { recursive: true, force: true })]);
  });
});

const mdapiConvertMultipleDirs = async (testDir: string, dirs: string[]): Promise<string[]> => {
  const cs = await ComponentSetBuilder.build({
    sourcepath: dirs.map(fnJoin(testDir)),
    projectDir: testDir,
  });

  // loads custom registry if there is one
  const registry = new RegistryAccess(undefined, testDir);
  const converter = new MetadataConverter(registry);

  await converter.convert(cs, 'metadata', {
    type: 'directory',
    outputDirectory: path.join(testDir, MDAPI_OUT),
    genUniqueDir: false,
  });
  const dirEnts = await fs.promises.readdir(path.join(testDir, MDAPI_OUT), {
    recursive: true,
    withFileTypes: true,
  });

  return dirEntsToPaths(dirEnts);
};
