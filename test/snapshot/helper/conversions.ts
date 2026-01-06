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
import * as path from 'node:path';
import * as fs from 'node:fs';
import snap from 'mocha-snap';
import { expect, config, use } from 'chai';
import deepEqualInAnyOrder from 'deep-equal-in-any-order';

import { parser } from '../../../src/utils/metadata';
import { RegistryAccess } from '../../../src/registry/registryAccess';
import { MetadataConverter } from '../../../src/convert/metadataConverter';
import { ComponentSetBuilder } from '../../../src/collections/componentSetBuilder';

export const MDAPI_OUT = 'mdapiOutput';
export const FORCE_APP = 'force-app';

use(deepEqualInAnyOrder);
config.truncateThreshold = 0;

/**
 * Common function to standardize snapshot behavior
 *
 * @param file the file to snapshot (full path)
 * @param testDir the directory where the snapshot will be stored
 * @param projectDir the root of the project.  This is usually the testDir by default, but they may not match if you have to copy the testDir to a new location during your test setup (to avoid mutating the original files)
 *
 */
export const fileSnap = async (file: string, testDir: string, projectDir?: string) =>
  shouldIgnore(file)
    ? Promise.resolve()
    : snap(await fs.promises.readFile(file, 'utf8'), {
        dir: testDir,
        file: simplifyFilePath(getRelative(projectDir ?? testDir)(file)),
      });

/**
 * converts a project's `originalMdapi` directory to source format
 * returns a list of all the files in the converted project
 */
export const mdapiToSource = async (testDir: string): Promise<string[]> => {
  const cs = await ComponentSetBuilder.build({
    sourcepath: [path.join(testDir, 'originalMdapi')],
    projectDir: testDir,
  });
  const registry = new RegistryAccess(undefined, testDir);
  const converter = new MetadataConverter(registry);

  // loads custom registry if there is one
  await converter.convert(
    cs,
    'source', // loads custom registry if there is one
    {
      type: 'directory',
      outputDirectory: path.resolve(path.join(testDir, FORCE_APP)),
      genUniqueDir: false,
    }
  );
  const dirEnts = await fs.promises.readdir(path.join(testDir, FORCE_APP), {
    recursive: true,
    withFileTypes: true,
  });

  return dirEntsToPaths(dirEnts);
};

export const sourceToMdapi = async (testDir: string): Promise<string[]> => {
  // cs from the entire project
  const cs = await ComponentSetBuilder.build({
    sourcepath: [path.join(testDir, FORCE_APP)],
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

/** checks that the two xml bodies have the same equivalent json (handles out-of-order things, etc) */
export const compareTwoXml = (file1: string, file2: string): Chai.Assertion => {
  const f1doc = parser.parse(file1);
  const f2doc = parser.parse(file2);
  return expect(f1doc).to.deep.equalInAnyOrder(f2doc);
};

/**
 * catches missing files by asserting that two directories have the exact same children
 * will throw if either directory doesn't exist
 */
export const dirsAreIdentical = async (dir1: string, dir2: string): Promise<Chai.Assertion> => {
  const dirs = [dir1, dir2].map(exists);

  const [files1, files2] = (await Promise.all(dirs.map(getAllDirents))).map(dirEntsToPaths).map(resolveRelative(dirs));

  return expect(files1).to.deep.equalInAnyOrder(files2);
};

const exists = (dir: string) => {
  expect(fs.existsSync(dir), `${dir} does not exist`).to.be.true;
  return dir;
};

const getAllDirents = (dir: string): fs.Dirent[] => fs.readdirSync(dir, { recursive: true, withFileTypes: true });

const resolveRelative = (parentDirs: string[]) => (subArray: string[], index: number) =>
  subArray.map(getRelative(parentDirs[index]));

const getRelative = (parent: string) => (child: string) => path.relative(parent, child);

const isFile = (file: fs.Dirent) => file.isFile();
const getFullPath = (file: fs.Dirent) => path.join(file.parentPath, file.name);

/** dirEnts are sometimes folder, we don't want those.  And we need the full paths */
export const dirEntsToPaths = (dirEnts: fs.Dirent[]): string[] => dirEnts.filter(isFile).map(getFullPath);

const shouldIgnore = (file: string): boolean => {
  // binary zip/unzip isn't exactly the same, so we "skip" that one
  if (file.includes('leafletjs.resource')) return true;
  return false;
};

/**
 * rather than the full path, gets the "project relative" parts based on format
 * will leave paths alone if they contain neither FORCE_APP/MDAPI_OUT
 */
const simplifyFilePath = (filePath: string): string =>
  filePath.includes(FORCE_APP) ? getPartsFromForceAppOnwards(filePath) : pathPartsAfter(filePath, MDAPI_OUT);

// handle MPD scenarios where force-app is 1 among several
const getPartsFromForceAppOnwards = (file: string): string => {
  const parts = file.split(path.sep);
  return parts.slice(parts.indexOf(FORCE_APP)).join(path.sep);
};

const pathPartsAfter = (file: string, after: string): string => {
  const parts = file.split(path.sep);
  return parts.slice(parts.indexOf(after) + 1).join(path.sep);
};

/** Wrap a function with it or pass it to map, and it will log the contents */
// @ts-ignore - keep this around for use when debugging.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const logArgs = <T>(args: T): T => {
  // eslint-disable-next-line no-console
  typeof args === 'string' ? console.log(args) : JSON.stringify(args, null, 2);
  return args;
};
