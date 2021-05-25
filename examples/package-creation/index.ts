/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ComponentSet,
  MetadataConverter,
  SourceComponent,
  // @ts-ignore
} from '@salesforce/source-deploy-retrieve';

/**
 * Create a manifest file (package.xml) from a list of members.
 *
 * e.g. 'ApexClass,myComponent:LightningComponentBundle,Hello:Layout,Hello2:Layout'
 */
export function createManifestFile(memberList: string): string {
  const memberStrings = memberList.split(',');
  const members = memberStrings.map((ms) => {
    const parts = ms.split(':');
    if (parts.length > 1) {
      return { fullName: parts[0], type: parts[1] };
    }
    return { fullName: '*', type: parts[0] };
  });
  const components = new ComponentSet(members);

  return components.getPackageXml();
}

/**
 * Converts components resolved from a file path to a "metadata format" package.
 */
export async function convertToMetadataFormat(
  fsPath: string,
  outputDirectory: string
): Promise<void> {
  const converter = new MetadataConverter();
  const components = ComponentSet.fromSource(fsPath);
  await converter.convert(components, 'metadata', {
    type: 'directory',
    outputDirectory,
  });
}

/**
 * Converts components resolved from a file path into a zipped "metadata format" package,
 * and outputs the base64 string of the zip file.
 */
export async function convertToMetadataFormatAndZip(fsPath: string): Promise<void> {
  const converter = new MetadataConverter();
  const components = ComponentSet.fromSource(fsPath);
  const { zipBuffer } = await converter.convert(components, 'metadata', { type: 'zip' });
  console.log(zipBuffer.toString('base64'));
}

/**
 * Converts components resolved from a file path into a "source format" package.
 */
export async function convertToSource(fsPath: string, outputDirectory: string): Promise<void> {
  const converter = new MetadataConverter();
  const components = ComponentSet.fromSource(fsPath);
  await converter.convert(components, 'source', {
    type: 'directory',
    outputDirectory,
  });
}

/**
 * Converts components resolved from a file path into a "source format" package,
 * and merges them with existing components.
 */
export async function convertToSourceAndMerge(
  fsPath: string,
  componentsToMergeWith: Iterable<SourceComponent>,
  defaultDirectory: string
): Promise<void> {
  const converter = new MetadataConverter();
  const components = ComponentSet.fromSource(fsPath);
  await converter.convert(components, 'source', {
    type: 'merge',
    mergeWith: componentsToMergeWith,
    defaultDirectory,
  });
}
