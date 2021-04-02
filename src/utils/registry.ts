/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MetadataXml } from '../resolution';
import { basename } from 'path';
import { SourcePath } from '../common';

/**
 * Returns the `MetadataXml` info from a given file path. If the path is not a
 * metadata xml file (-meta.xml), returns `undefined`
 *
 * @param path
 */
export const parseMetadataXml = (path: SourcePath): MetadataXml | undefined => {
  const match = basename(path).match(/(.+)\.(.+)-meta\.xml/);
  if (match) {
    return { fullName: match[1], suffix: match[2], path: path };
  }
};

/**
 * Deeply freezes an object, making the entire thing immutable.
 * @param object Object to deep freeze
 */
export const deepFreeze = <T>(object: T): Readonly<T> => {
  const propNames = Object.getOwnPropertyNames(object);
  for (const name of propNames) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const val = ((object as unknown) as any)[name];
    if (val && typeof val === 'object') {
      deepFreeze(val);
    }
  }
  return Object.freeze(object);
};
