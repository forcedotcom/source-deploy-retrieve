/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { basename, dirname, extname, sep } from 'node:path';
import { Optional } from '@salesforce/ts-types';
import { SourcePath } from '../common/types';
import { META_XML_SUFFIX } from '../common/constants';
import { MetadataXml } from '../resolve/types';

/**
 * Get the file or directory name at the end of a path. Different from `path.basename`
 * in that it strips anything after the first '.' in the name.
 *
 * @param fsPath The path to evaluate
 */
export function baseName(fsPath: SourcePath): string {
  return basename(fsPath).split('.')[0];
}

/**
 * the above baseName function doesn't handle components whose names have a `.` in them.
 * this will handle that, but requires you to specify the expected suffix from the mdType.
 *
 * @param fsPath The path to evaluate
 */
export function baseWithoutSuffixes(fsPath: SourcePath, suffix: string): string {
  return basename(fsPath)
    .replace(META_XML_SUFFIX, '')
    .split('.')
    .filter((part) => part !== suffix)
    .join('.');
}

/**
 * Get the name of file path extension. Different from path.extname in that it
 * does not include the '.' in the extension name. Returns an empty string if
 * there is no extension.
 *
 * @param fsPath The path to evaluate
 */
export function extName(fsPath: SourcePath): string {
  const split = extname(fsPath).split('.');
  return split.length > 1 ? split[1] : split[0];
}

/**
 * Get the name of the parent to the last portion of a path
 *
 * @param fsPath The path to evaluate
 */
export function parentName(fsPath: SourcePath): string {
  return basename(dirname(fsPath));
}

/**
 * Trim a path up until and including the given part. Returns `fsPath`
 * if the path `part` was not found.
 *
 * @param fsPath Path to trim
 * @param part Path part to trim up until
 * @param untilLast Trim until the *last* occurrence of `part`
 */
export function trimUntil(fsPath: SourcePath, part: string, untilLast = false): string {
  const parts = fsPath.split(sep);
  const partIndex = untilLast ? parts.lastIndexOf(part) : parts.findIndex((p) => part === p);
  if (partIndex === -1) {
    return fsPath;
  }
  return parts.slice(partIndex).join(sep);
}

/**
 * Returns the `MetadataXml` info from a given file path. If the path is not a
 * metadata xml file (-meta.xml), returns `undefined`.
 *
 * @param fsPath - File path to parse
 * @returns MetadataXml info or undefined
 */
export function parseMetadataXml(fsPath: string): Optional<MetadataXml> {
  const match = new RegExp(/(.+)\.(.+)-meta\.xml/).exec(basename(fsPath));
  if (match) {
    return { fullName: match[1], suffix: match[2], path: fsPath };
  }
}

/**
 * Returns the fullName for a nested metadata source file. This is for metadata
 * types that can be nested more than 1 level such as report and reportFolder,
 * dashboard and dashboardFolder, etc. It uses the directory name for the metadata type
 * as the starting point (non-inclusively) to parse the fullName.
 *
 * Examples:
 * (source format path)
 * fsPath: force-app/main/default/reports/foo/bar/My_Report.report-meta.xml
 * returns: foo/bar/My_Report
 *
 * (mdapi format path)
 * fsPath: unpackaged/reports/foo/bar-meta.xml
 * returns: foo/bar
 *
 * @param fsPath - File path to parse
 * @param directoryName - name of directory to use as a parsing index
 * @returns the FullName
 */
export function parseNestedFullName(fsPath: string, directoryName: string): string | undefined {
  const pathSplits = fsPath.split(sep);
  // Exit if the directoryName is not included in the file path.
  if (!pathSplits.includes(directoryName)) {
    return;
  }
  const pathPrefix = pathSplits.slice(pathSplits.lastIndexOf(directoryName) + 1);
  // the eslint comment should remain until strictMode is fully implemented
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const fileName = (pathSplits.pop() as string).replace('-meta.xml', '').split('.')[0];
  pathPrefix[pathPrefix.length - 1] = fileName;
  return pathPrefix.join('/');
}
