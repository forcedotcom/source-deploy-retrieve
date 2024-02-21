/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'node:path';
import * as fs from 'node:fs';
import snap from 'mocha-snap';
import { expect, config, use } from 'chai';
import * as deepEqualInAnyOrder from 'deep-equal-in-any-order';
import { XMLParser } from 'fast-xml-parser';

import { RegistryAccess } from '../../../src/registry/registryAccess';
import { MetadataConverter } from '../../../src/convert/metadataConverter';
import { ComponentSetBuilder } from '../../../src/collections/componentSetBuilder';

export const MDAPI_OUT = 'mdapiOutput';
export const FORCE_APP = 'force-app';

use(deepEqualInAnyOrder);
config.truncateThreshold = 0;

/** common function to standardize snapshot behavior */
export const fileSnap = async (file: string, testDir: string) =>
  shouldIgnore(file)
    ? void 0
    : snap(await fs.promises.readFile(file, 'utf8'), { dir: testDir, file: simplifyFilePath(file) });

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
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    parseAttributeValue: false,
    cdataPropName: '__cdata',
    ignoreDeclaration: true,
    numberParseOptions: { leadingZeros: false, hex: false },
  });

  return expect(parser.parse(file1)).to.deep.equalInAnyOrder(parser.parse(file2));
};

/** catches missing files by asserting that two directories have the exact same children */
export const dirsAreIdentical = async (dir1: string, dir2: string): Promise<Chai.Assertion> => {
  const [files1, files2] = (
    await Promise.all([
      fs.promises.readdir(dir1, { recursive: true, withFileTypes: true }),
      fs.promises.readdir(dir2, { recursive: true, withFileTypes: true }),
    ])
  ).map(dirEntsToPaths);
  return expect(files1).to.deep.equal(files2);
};

/** dirEnts are sometimes folder, we don't want those.  And we need the full paths */
const dirEntsToPaths = (dirEnts: fs.Dirent[]): string[] =>
  dirEnts.filter((file) => file.isFile()).map((file) => path.join(file.path, file.name));

const shouldIgnore = (file: string): boolean => {
  // binary zip/unzip isn't exactly the same, so we "skip" that one
  if (file.includes('leafletjs.resource')) return true;
  return false;
};

/** rather than the full path, gets the "project relative" parts based on format */
const simplifyFilePath = (filePath: string): string =>
  filePath.includes(FORCE_APP) ? getPartsFromBeforeForceApp(filePath) : pathPartsAfter(filePath, MDAPI_OUT);
// will leave paths alone if they contain neither string

// handle MPD scenarios where force-app is 1 among several
const getPartsFromBeforeForceApp = (file: string): string => {
  const parts = file.split(path.sep);
  return parts.slice(parts.indexOf(FORCE_APP)).join(path.sep);
};
const pathPartsAfter = (file: string, after: string): string => {
  const parts = file.split(path.sep);
  return parts.slice(parts.indexOf(after) + 1).join(path.sep);
};
