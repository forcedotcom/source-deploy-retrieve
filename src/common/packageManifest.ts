/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { parse as parseXml, j2xParser } from 'fast-xml-parser';
import {
  MetadataResolver,
  RegistryAccess,
  SourceComponent,
  TreeContainer,
} from '../metadata-registry';
import { ComponentSet } from './componentSet';
import { MetadataComponent, SourcePath } from './types';

interface PackageManifestOptions {
  registry?: RegistryAccess;
  input?: string | MetadataComponent[];
}

interface PackageTypeMember {
  name: string;
  members: string[];
}

interface PackageManifestContents {
  Package: {
    types: { name: string; members: string[] }[];
    version: string;
  };
}

export class PackageManifest {
  private registry: RegistryAccess;
  private _contents: PackageManifestContents;

  constructor(options?: PackageManifestOptions) {
    this.registry = options?.registry || new RegistryAccess();
    if (options?.input) {
      this.parse(options.input);
    }
  }

  public parse(xmlData: string): PackageManifestContents;
  public parse(components: MetadataComponent[]): PackageManifestContents;
  public parse(input: string | MetadataComponent[]): PackageManifestContents;
  public parse(input: string | MetadataComponent[]): PackageManifestContents {
    if (Array.isArray(input)) {
      const memberMap = new Map<string, string[]>();
      const componentSet = new ComponentSet();
      for (const component of input) {
        if (!componentSet.has(component)) {
          const { fullName, type } = component;
          if (!memberMap.has(type.name)) {
            memberMap.set(type.name, []);
          }
          memberMap.get(type.name).push(fullName);
          componentSet.add(component);
        }
      }

      const packageTypeMembers: PackageTypeMember[] = [];
      for (const [name, members] of memberMap) {
        packageTypeMembers.push({ name, members });
      }

      this._contents = {
        Package: {
          types: packageTypeMembers,
          version: this.registry.apiVersion,
        },
      };
    } else {
      this._contents = parseXml(input, {
        stopNodes: ['version'],
        ignoreNameSpace: false,
      }) as PackageManifestContents;
    }

    return this._contents;
  }

  public resolveComponents(root: SourcePath, options?: { tree: TreeContainer }): SourceComponent[] {
    const resolver = new MetadataResolver(this.registry, options?.tree);
    const typeMap = new Map<string, ComponentSet<MetadataComponent>>();
    for (const component of this.getComponents()) {
      if (!typeMap.has(component.type.id)) {
        typeMap.set(component.type.id, new ComponentSet());
      }
      typeMap.get(component.type.id).add(component);
    }
    // const componentSet = new ComponentSet(this.getComponents());
    const resolved = resolver.getComponentsFromPath(root);
    const final: SourceComponent[] = [];
    for (const component of resolved) {
      if (typeMap.get(component.type.id)?.has(component)) {
        final.push(component);
      } else {
        for (const childComponent of component.getChildren()) {
          if (typeMap.get(childComponent.type.id)?.has(childComponent)) {
            final.push(childComponent);
          }
        }
      }
    }
    return final;
  }

  public getComponents(): MetadataComponent[] {
    const components: MetadataComponent[] = [];
    for (const { name, members } of this._contents.Package.types) {
      const type = this.registry.getTypeByName(name);
      const fullNames = Array.isArray(members) ? members : [members];
      for (const fullName of fullNames) {
        const component = { fullName, type };
        components.push(component);
      }
    }
    return components;
  }

  public toString(): string {
    const j2x = new j2xParser({ format: true, indentBy: '    ', ignoreAttributes: false });
    return j2x.parse(this._contents);
  }

  get apiVersion(): string {
    return this._contents.Package.version;
  }

  get contents(): PackageManifestContents {
    return this._contents;
  }
}
