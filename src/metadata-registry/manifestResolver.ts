/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MetadataComponent } from '../common';
import { RegistryAccess } from './registryAccess';
import { NodeFSTreeContainer } from './treeContainers';
import { TreeContainer } from './types';
import { parse as parseXml } from 'fast-xml-parser';

export interface PackageTypeMembers {
  name: string;
  members: string[];
}

export interface PackageManifest {
  types: PackageTypeMembers[];
  version: string;
}

export interface ResolveManifestResult {
  components: MetadataComponent[];
  apiVersion: string;
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

    let types: PackageTypeMembers[];
    let apiVersion: string;

    try {
      const parsedManifest = parseXml(file.toString(), {
        stopNodes: ['version'],
        arrayMode: 'strict',
      }).Package[0];
      types = parsedManifest.types;
      apiVersion = parsedManifest.version;
    } catch (e) {
      throw new Error('Error parsing manifest file. Ensure it is properly formed');
    }

    for (const typeMembers of types) {
      const typeName = typeMembers.name[0];
      for (const fullName of typeMembers.members) {
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
