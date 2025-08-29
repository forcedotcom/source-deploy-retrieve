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

import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { ensureArray } from '@salesforce/kit';
import { SfError } from '@salesforce/core/sfError';
import { MetadataType } from '../registry/types';
import { RegistryAccess } from '../registry/registryAccess';
import { NodeFSTreeContainer, TreeContainer } from './treeContainers';
import { MetadataComponent } from './types';

export type PackageTypeMembers = {
  name: string;
  members: string[];
};

export type PackageManifest = {
  types: PackageTypeMembers[];
  version: string;
};

type ParsedPackageTypeMembers = {
  name: string;
  members: string | string[];
};

type ParsedPackageManifest = {
  types: ParsedPackageTypeMembers | ParsedPackageTypeMembers[];
  version: string;
};

export type ResolveManifestResult = {
  components: MetadataComponent[];
  apiVersion: string;
  fullName?: string;
};

/**
 * Resolve MetadataComponents from a manifest file (package.xml)
 */
export class ManifestResolver {
  private tree: TreeContainer;
  private registry: RegistryAccess;

  public constructor(tree: TreeContainer = new NodeFSTreeContainer(), registry = new RegistryAccess()) {
    this.tree = tree;
    this.registry = registry;
  }

  public async resolve(manifestPath: string): Promise<ResolveManifestResult> {
    const contents = (await this.tree.readFile(manifestPath)).toString();
    const validatedContents = validateFileContents(manifestPath)(contents);

    const parser = new XMLParser({
      stopNodes: ['version'],
      // In order to preserve the .0 on the apiVersion skip parsing it
      numberParseOptions: { leadingZeros: false, hex: false, skipLike: /\.0$/ },
    });

    const parsedManifest: ParsedPackageManifest = (
      parser.parse(validatedContents) as { Package: ParsedPackageManifest }
    ).Package;

    const components = ensureArray(parsedManifest.types)
      .map(getValidatedType(manifestPath))
      .flatMap((typeMembers) => {
        const type = this.registry.getTypeByName(typeMembers.name);
        const parentType = type.folderType ? this.registry.getTypeByName(type.folderType) : undefined;
        return ensureArray(typeMembers.members).map((fullName, _index, members) => ({
          fullName: resolveFullName(fullName, parentType),
          type: !parentType ? type : resolveType(fullName, type, members, parentType),
        }));
      });

    return { components, apiVersion: parsedManifest.version };
  }
}

/** throw a nice validation error if the contents are invalid.  Otherwise, returns the contents */
const validateFileContents =
  (manifestPath: string) =>
  (file: string): string => {
    const validateResult = XMLValidator.validate(file);
    if (validateResult !== true) {
      const error = new SfError(
        `Invalid manifest file: ${manifestPath}.  ${validateResult.err.code}: ${validateResult.err.msg} (Line ${validateResult.err.line} Column ${validateResult.err.col})`,
        'InvalidManifest'
      );
      error.setData(validateResult.err);
      throw error;
    }
    return file;
  };

/** protect against empty/invalid typeMember definitions in the manifest */
const getValidatedType =
  (manifestPath: string) =>
  (typeMembers: ParsedPackageTypeMembers): ParsedPackageTypeMembers => {
    let typeName = typeMembers.name;
    // protect against empty/invalid typeMember definitions in the manifest
    if (typeof typeName !== 'string' || typeName.length === 0) {
      if (typeof typeName === 'object') {
        typeName = JSON.stringify(typeName);
      }
      const err = new Error(`Invalid types definition in manifest file: ${manifestPath}\nFound: "${typeName ?? ''}"`);
      err.name = 'InvalidManifest';
      throw err;
    }
    return typeMembers;
  };

// Mostly for parents of InFolder types to strip off trailing "/" characters
// in fullNames. Otherwise just returns the fullName.
const resolveFullName = (fullName: string, parentType?: MetadataType): string =>
  parentType?.folderContentType && fullName.endsWith('/') ? fullName.substring(0, fullName.length - 1) : fullName;

// Resolve the correct metadata type from metadata entries in a manifest.
// Parents of InFolder types can be detected by looking for a trailing "/"
// character.
const resolveType = (
  fullName: string,
  type: MetadataType,
  members: string[],
  parentType?: MetadataType
): MetadataType => {
  // Quick short-circuit for non-parent types and non-folderTypes
  if (!parentType || !type.folderType) {
    return type;
  }

  // Detect parents of InFolder types by looking for a trailing slash on InFolder types
  if (parentType?.folderContentType && fullName.endsWith('/')) {
    return parentType;
  }

  return isMemberNestedInFolder(fullName, type, parentType, members) ? parentType : type;
};

// Use the folderType instead of the type from the manifest when:
//  1. InFolder types: (report, dashboard, emailTemplate, document)
//    1a. type.inFolder === true (from metadataRegistry.json) AND
//    1b. The fullName doesn't contain a forward slash character AND
//    1c. The fullName with a slash appended is contained in another member entry
// OR
//  2. Non-InFolder, folder types: (territory2, territory2Model, territory2Type, territory2Rule)
//    2a. type.inFolder !== true (from metadataRegistry.json) AND
//    2b. type.folderType has a value (from metadataRegistry.json) AND
//    2c. This type's parent type has a folderType that doesn't match its ID.
const isMemberNestedInFolder = (
  fullName: string,
  type: MetadataType,
  parentType: MetadataType,
  members: string[]
): boolean => {
  const isInFolderType = type.inFolder;
  const isNestedInFolder = !fullName.includes('/') || members.some((m) => m.includes(`${fullName}/`));
  const isNonMatchingFolder = parentType && parentType.folderType !== parentType.id;

  return isInFolderType ? isNestedInFolder : isNonMatchingFolder;
};
