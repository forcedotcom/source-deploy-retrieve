/*
 * Copyright 2025, Salesforce, Inc.
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

import { basename, dirname, extname, sep, join } from 'node:path';
import { Optional } from '@salesforce/ts-types';
import { SfdxFileFormat } from '../convert/types';
import { SourcePath } from '../common/types';
import { DEFAULT_PACKAGE_ROOT_SFDX, META_XML_SUFFIX } from '../common/constants';
import { MetadataXml } from '../resolve/types';
import { MetadataType } from '../registry/types';

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
 * this will handle that, but requires you to specify the mdType to check suffixes for.
 *
 * @param fsPath The path to evaluate
 */
export function baseWithoutSuffixes(fsPath: SourcePath, mdType: MetadataType): string {
  return basename(fsPath).replace(META_XML_SUFFIX, '').split('.').filter(stringIsNotSuffix(mdType)).join('.');
}

const stringIsNotSuffix =
  (type: MetadataType) =>
  (part: string): boolean =>
    part !== type.suffix && (!type.legacySuffix || part !== type.legacySuffix);

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

export const calculateRelativePath =
  (format: SfdxFileFormat) =>
  (types: { self: MetadataType; parentType?: MetadataType }) =>
  (fullName: string) =>
  (fsPath: string): string => {
    const base = format === 'source' ? DEFAULT_PACKAGE_ROOT_SFDX : '';
    const { directoryName, suffix, inFolder, folderType, folderContentType } = types.self;

    // if there isn't a suffix, assume this is a mixed content component that must
    // reside in the directoryName of its type. trimUntil maintains the folder structure
    // the file resides in for the new destination. This also applies to inFolder types:
    // (report, dashboard, emailTemplate, document) and their folder container types:
    // (reportFolder, dashboardFolder, emailFolder, documentFolder)
    // It also applies to DigitalExperienceBundle types as we need to maintain the folder structure
    if (
      !suffix ||
      Boolean(inFolder) ||
      typeof folderContentType === 'string' ||
      ['digitalexperiencebundle', 'digitalexperience'].includes(types.self.id)
    ) {
      return join(base, trimUntil(fsPath, directoryName, true));
    }

    if (folderType) {
      // types like Territory2Model have child types inside them.  We have to preserve those folder structures
      if (types.parentType?.folderType && types.parentType?.folderType !== types.self.id) {
        return join(base, trimUntil(fsPath, types.parentType.directoryName));
      }
      return join(base, directoryName, fullName.split('/')[0], basename(fsPath));
    }
    return join(base, directoryName, basename(fsPath));
  };

/** (a)(b)=> a/b */
export const fnJoin =
  (a: string) =>
  (b: string): string =>
    join(a, b);
