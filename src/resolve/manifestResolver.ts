/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { XMLParser } from 'fast-xml-parser';
import { ensureArray } from '@salesforce/kit';
import { MetadataType, RegistryAccess } from '../registry';
import { NodeFSTreeContainer, TreeContainer } from './treeContainers';
import { MetadataComponent } from './types';

export interface PackageTypeMembers {
  name: string;
  members: string[];
}

export interface PackageManifest {
  types: PackageTypeMembers[];
  version: string;
}

interface ParsedPackageTypeMembers {
  name: string;
  members: string | string[];
}

interface ParsedPackageManifest {
  types: ParsedPackageTypeMembers | ParsedPackageTypeMembers[];
  version: string;
}

export interface ResolveManifestResult {
  components: MetadataComponent[];
  apiVersion: string;
  fullName?: string;
}

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
    const components: MetadataComponent[] = [];

    const file = await this.tree.readFile(manifestPath);

    const parser = new XMLParser({
      stopNodes: ['version'],
      // In order to preserve the .0 on the apiVersion skip parsing it
      numberParseOptions: { leadingZeros: false, hex: false, skipLike: /\.0$/ },
    });
    const parsedManifest: ParsedPackageManifest = (parser.parse(String(file)) as { Package: ParsedPackageManifest })
      .Package;
    const packageTypeMembers = ensureArray(parsedManifest.types);
    const apiVersion = parsedManifest.version;

    for (const typeMembers of packageTypeMembers) {
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
      const type = this.registry.getTypeByName(typeName);
      const parentType = type.folderType ? this.registry.getTypeByName(type.folderType) : undefined;
      const members = ensureArray(typeMembers.members);

      for (const fullName of members) {
        let mdType = type;
        if (isMemberNestedInFolder(fullName, type, parentType, members)) {
          mdType = parentType;
        }
        components.push({ fullName, type: mdType });
      }
    }

    return { components, apiVersion };
  }
}

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
  // Quick short-circuit for non-folderTypes
  if (!type.folderType) {
    return false;
  }

  const isInFolderType = type.inFolder;
  const isNestedInFolder = !fullName.includes('/') || members.some((m) => m.includes(`${fullName}/`));
  const isNonMatchingFolder = parentType && parentType.folderType !== parentType.id;

  return (isInFolderType && isNestedInFolder) || (!isInFolderType && isNonMatchingFolder);
};
