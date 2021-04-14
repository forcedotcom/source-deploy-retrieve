/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RegistryAccess } from '../registry';
import { NodeFSTreeContainer, TreeContainer } from './treeContainers';
import { MetadataComponent } from './types';
import { parse as parseXml } from 'fast-xml-parser';
import { normalizeToArray } from '../utils';

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

  constructor(tree: TreeContainer = new NodeFSTreeContainer(), registry = new RegistryAccess()) {
    this.tree = tree;
    this.registry = registry;
  }

  public async resolve(manifestPath: string): Promise<ResolveManifestResult> {
    const components: MetadataComponent[] = [];

    const file = await this.tree.readFile(manifestPath);

    const parsedManifest: ParsedPackageManifest = parseXml(file.toString(), {
      stopNodes: ['version'],
    }).Package;
    const packageTypeMembers = normalizeToArray(parsedManifest.types);
    const apiVersion = parsedManifest.version;

    for (const typeMembers of packageTypeMembers) {
      const typeName = typeMembers.name;
      for (const fullName of normalizeToArray(typeMembers.members)) {
        let type = this.registry.getTypeByName(typeName);
        // if there is no / delimiter and it's a type in folders, infer folder component
        if (type.folderType && !fullName.includes('/')) {
          type = this.registry.getTypeByName(type.folderType);
        }
        components.push({ fullName, type });
      }
    }

    return { components, apiVersion };
  }
}
