/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection } from '@salesforce/core';
import { parse as parseXml, j2xParser } from 'fast-xml-parser';
import { MetadataApi } from '../client/metadataApi';
import { MetadataDeployOptions, SourceDeployResult, SourceRetrieveResult } from '../client/types';
import {
  ManifestGenerator,
  MetadataResolver,
  NodeFSTreeContainer,
  RegistryAccess,
  SourceComponent,
  TreeContainer,
} from '../metadata-registry';
import { ComponentSet } from './componentSet';
import { MetadataComponent } from './types';

interface PackageTypeMember {
  name: string;
  members: string[];
}

interface PackageManifestContents {
  Package: {
    types: PackageTypeMember[];
    version: string;
  };
}

interface MetadataPackageOptions {
  registry?: RegistryAccess;
}

interface SourcePackageOptions extends MetadataPackageOptions {
  tree?: TreeContainer;
}

interface InternalOptions extends MetadataPackageOptions {
  components?: MetadataComponent[];
  resolvePath?: SourceComponent[];
  xmlContent?: string;
}

export class MetadataPackage {
  public apiVersion: string;
  private registry: RegistryAccess;
  private typeMembers: PackageTypeMember[];
  private _components?: Map<string, MetadataComponent>;
  private _sourceComponents?: Map<string, SourceComponent>;

  private constructor(options?: InternalOptions) {
    const { components, xmlContent, registry } = options;

    this.registry = registry || new RegistryAccess();
    this.apiVersion = this.registry.apiVersion;

    if (components) {
      this._components = new Map<string, MetadataComponent>();
      this.initializeComponents(this._components, components);
    } else if (xmlContent) {
      const { types, version } = (parseXml(xmlContent, {
        stopNodes: ['version'],
        ignoreNameSpace: false,
      }) as PackageManifestContents).Package;
      this.apiVersion = version;
      this.typeMembers = types;
    }
  }

  public static fromSource(fsPath: string, options?: SourcePackageOptions): MetadataPackage {
    const mdPackage = new MetadataPackage({ registry: options?.registry });
    mdPackage.getSourceComponents({ resolve: fsPath, tree: options?.tree, new: true });
    return mdPackage;
  }

  public static async fromManifestFile(
    fsPath: string,
    options?: SourcePackageOptions
  ): Promise<MetadataPackage> {
    const tree = options?.tree || new NodeFSTreeContainer();
    const file = await tree.readFile(fsPath);
    return new MetadataPackage({
      registry: options?.registry,
      xmlContent: file.toString(),
    });
  }

  public async deploy(
    connection: Connection,
    options?: MetadataDeployOptions
  ): Promise<SourceDeployResult>;
  public async deploy(
    username: string,
    options?: MetadataDeployOptions
  ): Promise<SourceDeployResult>;
  public async deploy(
    auth: Connection | string,
    options?: MetadataDeployOptions
  ): Promise<SourceDeployResult> {
    const connection =
      auth instanceof Connection
        ? auth
        : await Connection.create({
            authInfo: await AuthInfo.create({ username: auth }),
          });
    const client = new MetadataApi(connection, new MetadataResolver());
    return client.deploy(this.getSourceComponents(), options);
  }

  public async retrieve(
    connection: Connection,
    options?: { merge?: boolean; output?: string; wait?: number }
  ): Promise<SourceRetrieveResult>;
  public async retrieve(
    username: string,
    options?: { merge?: boolean; output?: string; wait?: number }
  ): Promise<SourceRetrieveResult>;
  public async retrieve(
    auth: Connection | string,
    options?: { merge?: boolean; output?: string; wait?: number }
  ): Promise<SourceRetrieveResult> {
    const connection =
      auth instanceof Connection
        ? auth
        : await Connection.create({
            authInfo: await AuthInfo.create({ username: auth }),
          });
    const client = new MetadataApi(connection, new MetadataResolver());
    return client.retrieve({
      components: this.getSourceComponents(),
      merge: options?.merge,
      output: options?.output,
      wait: options?.wait,
    });
  }

  public getObject(): PackageManifestContents {
    if (!this.typeMembers) {
      const typeMap = new Map<string, string[]>();
      for (const component of this.getComponents()) {
        if (!typeMap.has(component.type.name)) {
          typeMap.set(component.type.name, []);
        }
        typeMap.get(component.type.name).push(component.fullName);
      }

      const typeMembers: PackageTypeMember[] = [];
      for (const [typeName, fullNames] of typeMap.entries()) {
        typeMembers.push({ name: typeName, members: fullNames });
      }

      this.typeMembers = typeMembers;
    }

    return {
      Package: {
        types: this.typeMembers,
        version: this.apiVersion,
      },
    };
  }

  public getComponents(): MetadataComponent[] {
    let components: MetadataComponent[];
    if (this._components) {
      components = Array.from(this._components?.values());
    } else if (this.typeMembers) {
      components = this.setAndGetComponentsFromMembers();
    } else if (this._sourceComponents) {
      components = [];
      this._components = new Map<string, MetadataComponent>();
      for (const [id, sourceComponent] of this._sourceComponents.entries()) {
        const component = { type: sourceComponent.type, fullName: sourceComponent.fullName };
        components.push(component);
        this._components.set(id, component);
      }
    }
    return components;
  }

  public getSourceComponents(options?: {
    resolve?: string;
    tree?: TreeContainer;
    new?: boolean;
  }): SourceComponent[] {
    if (!options?.resolve) {
      return Array.from(this._sourceComponents?.values() || []);
    }
    const resolver = new MetadataResolver(this.registry, options?.tree);
    const resolved = resolver.getComponentsFromPath(options.resolve);

    const sourceComponentMap = new Map<string, SourceComponent>();
    const componentMap = new Map<string, MetadataComponent>();
    const typeMap = new Map<string, ComponentSet<MetadataComponent>>();

    if (!options?.new) {
      for (const component of this.getComponents()) {
        if (!typeMap.has(component.type.id)) {
          typeMap.set(component.type.id, new ComponentSet());
        }
        typeMap.get(component.type.id).add(component);
      }
    }

    const final: SourceComponent[] = [];

    for (const component of resolved) {
      if (options?.new || typeMap.get(component.type.id)?.has(component)) {
        final.push(component);
        componentMap.set(this.key(component), {
          fullName: component.fullName,
          type: component.type,
        });
        sourceComponentMap.set(this.key(component), component);
      } else {
        for (const childComponent of component.getChildren()) {
          if (typeMap.get(childComponent.type.id)?.has(childComponent)) {
            final.push(childComponent);
            componentMap.set(this.key(childComponent), {
              fullName: childComponent.fullName,
              type: childComponent.type,
            });
            sourceComponentMap.set(this.key(childComponent), childComponent);
          }
        }
      }
    }

    this._sourceComponents = sourceComponentMap;
    this._components = componentMap;
    this.typeMembers = undefined;

    return final;
  }

  public getXml(): string {
    if (this.typeMembers) {
      const j2x = new j2xParser({
        format: true,
        indentBy: '    ',
        ignoreAttributes: false,
      });
      return j2x.parse(this.getObject());
    }

    const components = this.getComponents();
    if (components) {
      const generator = new ManifestGenerator(undefined, this.registry);
      return generator.createManifest(components, this.apiVersion);
    }

    throw new Error('nothing initialized');
  }

  private initializeComponents(
    map: Map<string, MetadataComponent>,
    components: MetadataComponent[]
  ): void {
    for (const component of components) {
      map.set(this.key(component), component);
    }
  }

  private setAndGetComponentsFromMembers(): MetadataComponent[] {
    const components: MetadataComponent[] = [];
    this._components = new Map<string, MetadataComponent>();
    for (const { name, members } of this.typeMembers) {
      const type = this.registry.getTypeByName(name);
      const fullNames = Array.isArray(members) ? members : [members];
      for (const fullName of fullNames) {
        const component = { fullName, type };
        components.push(component);
        this._components.set(this.key(component), component);
      }
    }
    return components;
  }

  private key(component: MetadataComponent): string {
    return `${component.type.id}/${component.fullName}`;
  }
}
