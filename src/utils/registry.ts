/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MetadataXml } from '../resolution';
import { basename } from 'path';

/**
 * Returns the `MetadataXml` info from a given file path. If the path is not a
 * metadata xml file (-meta.xml), returns `undefined`
 *
 * @param fsPath - File path to parse
 * @returns MetadataXml info or undefined
 */
export const parseMetadataXml = (fsPath: string): MetadataXml | undefined => {
  const match = basename(fsPath).match(/(.+)\.(.+)-meta\.xml/);
  if (match) {
    return { fullName: match[1], suffix: match[2], path: fsPath };
  }
};
