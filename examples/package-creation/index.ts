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
