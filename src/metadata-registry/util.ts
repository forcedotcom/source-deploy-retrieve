/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SourcePath, MetadataXml } from './types';
import { basename, join } from 'path';
import { readdirSync, lstatSync } from 'fs';

/**
 * Returns the `MetadataXml` info from a given file path. If the path is not a
 * metadata xml file (-meta.xml), returns `undefined`
 *
 * @param fsPath
 */
export const parseMetadataXml = (
  fsPath: SourcePath
): MetadataXml | undefined => {
  const match = basename(fsPath).match(/(.+)\.(.+)-meta\.xml/);
  if (match) {
    return { fullName: match[1], suffix: match[2] };
  }
};

/**
 * Get the file or directory name at the end of a path. This custom version of
 * path.basename ensures no suffixes at the end.
 *
 * @param fsPath
 */
export const parseBaseName = (fsPath: SourcePath): string => {
  return basename(fsPath).split('.')[0];
};

export const isDirectory = (fsPath: SourcePath): boolean =>
  lstatSync(fsPath).isDirectory();

export const walk = (
  dir: SourcePath,
  ignorePaths?: Set<SourcePath>
): SourcePath[] => {
  const paths: SourcePath[] = [];
  for (const file of readdirSync(dir)) {
    const path = join(dir, file);
    if (isDirectory(path)) {
      paths.push(...walk(path, ignorePaths));
    } else if (!ignorePaths || !ignorePaths.has(path)) {
      paths.push(path);
    }
  }
  return paths;
};

const find = (
  directory: SourcePath,
  fullName: string,
  findMetaXml: boolean
): SourcePath | undefined => {
  const fileName = readdirSync(directory).find(f => {
    const parsed = parseMetadataXml(join(directory, f));
    const metaXmlCondition = findMetaXml ? !!parsed : !parsed;
    return f.startsWith(fullName) && metaXmlCondition;
  });
  if (fileName) {
    return join(directory, fileName);
  }
};

export const findMetadataXml = (
  directory: SourcePath,
  fullName: string
): SourcePath | undefined => find(directory, fullName, true);

/**
 * If there's more than one content file with the same fullName, it will
 * return the first one found.
 */
export const findMetadataContent = (
  directory: SourcePath,
  fullName: string
): SourcePath | undefined => find(directory, fullName, false);
