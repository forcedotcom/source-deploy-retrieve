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
