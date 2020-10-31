/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection } from '@salesforce/core';
import { parse as parseXml, j2xParser } from 'fast-xml-parser';
import { SourceClient } from '../client';
import { MetadataDeployOptions, SourceDeployResult, SourceRetrieveResult } from '../client/types';
import {
  ManifestGenerator,
  MetadataResolver,
  NodeFSTreeContainer,
  RegistryAccess,
  SourceComponent,
  TreeContainer,
} from '../metadata-registry';
import { MetadataComponent } from '../common/types';
import { ComponentCollection } from '../common/componentCollection';
import {
  PackageTypeMembers,
  FromSourceOptions,
  FromManifestOptions,
  PackageManifestContents,
} from './types';

export class MetadataPackage {
  public apiVersion: string;
  private registry: RegistryAccess;
  private typeMembers: PackageTypeMembers[];
  private _components?: ComponentCollection<MetadataComponent>;
  private _sourceComponents?: ComponentCollection<SourceComponent>;

  private constructor(registry = new RegistryAccess()) {
    this.registry = registry;
    this.apiVersion = registry.apiVersion;
  }

  /**
   * Create a package by resolving `SourceComponents` from a given path.
   *
   * ```
   * MetadataPackage.fromSource('/path/to/force-app')
   * ```
   *
   * @param fsPath Path to resolve components from
   * @param options
   */
  public static fromSource(fsPath: string, options?: FromSourceOptions): MetadataPackage {
    const mdPackage = new MetadataPackage(options?.registry);
    mdPackage.getSourceComponents({ resolve: fsPath, tree: options?.tree, new: true });
    return mdPackage;
  }

  /**
   * Create a package by reading a manifest file in xml format.
   *
   * Optionally, specify a file path with the `resolve` option to resolve for matching SourceComponents in the manifest.
   *
   * ```
   * MetadataPackage.fromManifest('/path/to/package.xml', {
   *  resolve: '/path/to/force-app'
   * });
   * ```
   *
   * @param fsPath Path to xml file
   * @param options
   */
  public static async fromManifestFile(
    fsPath: string,
    options?: FromManifestOptions
  ): Promise<MetadataPackage> {
    const tree = options?.tree || new NodeFSTreeContainer();
    const file = await tree.readFile(fsPath);
    const mdPackage = new MetadataPackage(options?.registry);
    const { types, version } = (parseXml(file.toString(), {
      stopNodes: ['version'],
      ignoreNameSpace: false,
    }) as PackageManifestContents).Package;
    mdPackage.apiVersion = version;
    mdPackage.typeMembers = types;
    if (options?.resolve) {
      mdPackage.getSourceComponents({ resolve: options?.resolve, tree, new: true });
    }
    return mdPackage;
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
    const connection = await this.getConnection(auth);
    const client = new SourceClient(connection, new MetadataResolver());
    return client.metadata.deploy(this.getSourceComponents().getAll(), options);
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
    const connection = await this.getConnection(auth);
    const client = new SourceClient(connection, new MetadataResolver());
    return client.metadata.retrieve({
      components: this.getSourceComponents().getAll(),
      merge: options?.merge,
      output: options?.output,
      wait: options?.wait,
    });
  }

  /**
   * Get an object representation of the package manifest.
   */
  public getObject(): PackageManifestContents {
    if (!this.typeMembers) {
      const typeMembers: PackageTypeMembers[] = [];
      for (const [typeName, components] of this.getComponents().entries()) {
        const members: string[] = [];
        for (const { fullName } of components.values()) {
          members.push(fullName);
        }
        typeMembers.push({ name: typeName, members });
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

  /**
   * Get a collection of MetadataComponents included in the package. Different from
   * `getSourceComponents()` in that if source files have not been resolved with the
   * components, only component FullName and Type information is returned.
   *
   * ```
   * const manifestPackage = await MetadataPackage.fromManifest('/path/to/package.xml');
   * const collection = manifestPackage.getComponents();
   * for (const [typeName, components] of collection.entries()) {
   *  console.log(`${typeName} count: ${components.size}`)
   * }
   * ```
   */
  public getComponents(): ComponentCollection<MetadataComponent> {
    if (this._components) {
      return this._components;
    } else if (this._sourceComponents) {
      return this._sourceComponents;
    } else if (this.typeMembers) {
      this.setComponentsFromMembers();
      return this._components;
    }
    throw new Error('asdf');
  }

  /**
   * Get a collection of `SourceComponents` from the package. If `SourceComponents` were not
   * resolved during package initialization, returns `undefined`. To resolve components for
   * the existing package, specify the `resolve` option with a path to resolve the package against.
   * `SourceComponents` are cached for subsequent requests unless explicitly resolved.
   *
   * ```
   * // pre-resolved
   * const sourcePackage = MetadataPackage.fromSource('/path/to/force-app');
   * sourcePackage.getSourceComponents();
   *
   * // unresolved at initialization
   * const manifestPackage = await MetadataPackage.fromManifestFile('/path/to/package.xml');
   * const components = manifestPackage.getSourceComponents({ resolve: '/path/to/force-app' });
   * ```
   *
   * @param options
   */
  public getSourceComponents(options?: {
    resolve?: string;
    tree?: TreeContainer;
    new?: boolean;
  }): ComponentCollection<SourceComponent> | undefined {
    if (!options?.resolve) {
      return this._sourceComponents;
    }

    let filterSet: ComponentCollection<MetadataComponent>;

    if (options?.new) {
      this._components = undefined;
      this.typeMembers = undefined;
    } else {
      filterSet = this.getComponents();
    }

    // TODO: move filter logic to resolver and have it return ComponentCollection
    const resolver = new MetadataResolver(this.registry, options?.tree);
    const resolved = resolver.getComponentsFromPath(options.resolve);
    const sourceComponentMap = new ComponentCollection<SourceComponent>();

    for (const component of resolved) {
      if (options?.new || filterSet.has(component)) {
        sourceComponentMap.add(component);
      } else if (!options?.new) {
        for (const childComponent of component.getChildren()) {
          if (filterSet.has(childComponent)) {
            sourceComponentMap.add(childComponent);
          }
        }
      }
    }

    this._sourceComponents = sourceComponentMap;

    return this._sourceComponents;
  }

  /**
   * Create a manifest xml string (package.xml) from the package components.
   */
  public getPackageXml(): string {
    if (this.typeMembers) {
      const j2x = new j2xParser({
        format: true,
        indentBy: '    ',
        ignoreAttributes: false,
      });
      return j2x.parse(this.getObject());
    }

    const generator = new ManifestGenerator(undefined, this.registry);

    return generator.createManifest(this.getComponents().getAll(), this.apiVersion);
  }

  private async getConnection(auth: Connection | string): Promise<Connection> {
    return auth instanceof Connection
      ? auth
      : await Connection.create({
          authInfo: await AuthInfo.create({ username: auth }),
        });
  }

  private setComponentsFromMembers(): void {
    const components = new ComponentCollection<MetadataComponent>();
    for (const { name, members } of this.typeMembers) {
      const type = this.registry.getTypeByName(name);
      const fullNames = Array.isArray(members) ? members : [members];
      for (const fullName of fullNames) {
        const component = { fullName, type };
        components.add(component);
      }
    }
    this._components = components;
  }
}
