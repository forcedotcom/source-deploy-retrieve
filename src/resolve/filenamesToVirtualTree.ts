/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import { VirtualTreeContainer } from './treeContainers';
import { VirtualDirectory } from './types';
/**
 * Designed for recreating virtual files from deleted files where the only information we have is the file's former location
 * Any use of MetadataResolver was trying to access the non-existent files and throwing
 *
 * @param filenames full paths to files
 * @returns VirtualTreeContainer to use with MetadataResolver
 */
export const filenamesToVirtualTree = (filenames: string[]): VirtualTreeContainer => {
  // a map to reduce array iterations
  const virtualDirectoryByFullPath = new Map<string, VirtualDirectory>();
  filenames.map((filename) => {
    const splits = filename.split(path.sep);
    for (let i = 0; i < splits.length - 1; i++) {
      const fullPathSoFar = splits.slice(0, i + 1).join(path.sep);
      const existing = virtualDirectoryByFullPath.get(fullPathSoFar);
      virtualDirectoryByFullPath.set(fullPathSoFar, {
        dirPath: fullPathSoFar,
        // only add to children if we don't already have it
        children: Array.from(new Set(existing?.children ?? []).add(splits[i + 1])),
      });
    }
  });
  return new VirtualTreeContainer(Array.from(virtualDirectoryByFullPath.values()));
};
