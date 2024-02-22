/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'node:path';
import * as fs from 'node:fs';
import snap from 'mocha-snap';
import { expect } from 'chai';
import { Dirent } from 'graceful-fs';
import { MetadataConverter } from '../../../src/convert/metadataConverter';
import { ComponentSetBuilder } from '../../../src/collections/componentSetBuilder';

const converter = new MetadataConverter();
const MDAPI_OUT = 'mdapiOutput';
const FORCE_APP = 'force-app';

/** common function to standardize snapshot behavior */
export const fileSnap = async (file: string, testDir: string, projectDir?: string) =>
  shouldIgnore(file)
    ? void 0
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
  });
  await converter.convert(cs, 'source', {
    type: 'directory',
    outputDirectory: path.resolve(path.join(testDir, 'force-app')),
    genUniqueDir: false,
  });
  const dirEnts = await fs.promises.readdir(path.join(testDir, 'force-app'), {
    recursive: true,
    withFileTypes: true,
  });

  return dirEntsToPaths(dirEnts);
};

export const sourceToMdapi = async (testDir: string): Promise<string[]> => {
  // cs from the entire project
  const cs = await ComponentSetBuilder.build({
    sourcepath: [path.join(testDir, 'force-app')],
  });
  await converter.convert(cs, 'metadata', {
    type: 'directory',
    outputDirectory: path.join(testDir, 'mdapiOutput'),
    genUniqueDir: false,
  });
  const dirEnts = await fs.promises.readdir(path.join(testDir, 'mdapiOutput'), {
    recursive: true,
    withFileTypes: true,
  });

  return dirEntsToPaths(dirEnts);
};

/**
 * catches missing files by asserting that two directories have the exact same children
 * will throw if either directory doesn't exist
 */
export const dirsAreIdentical = async (dir1: string, dir2: string): Promise<Chai.Assertion> => {
  const dirs = [dir1, dir2].map(exists);

  const [files1, files2] = (await Promise.all(dirs.map(getAllDirents))).map(dirEntsToPaths).map(resolveRelative(dirs));

  return expect(files1).to.deep.equal(files2);
};

const exists = (dir: string) => {
  expect(fs.existsSync(dir), `${dir} does not exist`).to.be.true;
  return dir;
};

const getAllDirents = (dir: string): Dirent[] => fs.readdirSync(dir, { recursive: true, withFileTypes: true });

const resolveRelative = (parentDirs: string[]) => (subArray: string[], index: number) =>
  subArray.map(getRelative(parentDirs[index]));

const getRelative = (parent: string) => (child: string) => path.relative(parent, child);

const isFile = (file: fs.Dirent) => file.isFile();
const getFullPath = (file: fs.Dirent) => path.join(file.path, file.name);

/** dirEnts are sometimes folder, we don't want those.  And we need the full paths */
export const dirEntsToPaths = (dirEnts: fs.Dirent[]): string[] => dirEnts.filter(isFile).map(getFullPath);

const shouldIgnore = (file: string): boolean => {
  // binary zip/unzip isn't exactly the same, so we "skip" that one
  if (file.includes('leafletjs.resource')) return true;
  return false;
};

// will leave paths alone if they contain neither string {}
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

// keep this around for use when debugging.  Wrap a function with it or pass it to map, and it will log the contents
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const logArgs = <T>(args: T): T => {
  // eslint-disable-next-line no-console
  typeof args === 'string' ? console.log(args) : JSON.stringify(args, null, 2);
  return args;
};
