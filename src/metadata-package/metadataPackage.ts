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
import {
  MetadataComponent,
  ComponentCollection,
  XML_DECL,
  XML_NS_KEY,
  XML_NS_URL,
} from '../common';
import {
  PackageTypeMembers,
  FromSourceOptions,
  FromManifestOptions,
  PackageManifestContents,
  SourceComponentOptions,
  MetadataMember,
  MetadataPackageOptions,
} from './types';
import { MetadataPackageError } from '../errors';

export class MetadataPackage {
  public apiVersion: string;
  private registry: RegistryAccess;
  private typeMembers: PackageTypeMembers[] = [];
  private _components = new ComponentCollection<MetadataComponent>();
  private _sourceComponents = new ComponentCollection<SourceComponent>();

  public constructor(registry = new RegistryAccess()) {
    this.registry = registry;
    this.apiVersion = registry.apiVersion;
  }

  /**
   * Create a package by resolving metadata components and their associated source files from a given path.
   *
   * @param fsPath Path to resolve components from
   * @param options
   */
  public static fromSource(fsPath: string, options?: FromSourceOptions): MetadataPackage {
    const mdPackage = new MetadataPackage(options?.registry);
    mdPackage.getSourceComponents({ resolve: fsPath, tree: options?.tree, reinitialize: true });
    return mdPackage;
  }

  /**
   * Create a package by reading a manifest file in xml format. Optionally, specify a file path
   * with the `resolve` option to resolve source files for the components.
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
      mdPackage.getSourceComponents({ resolve: options?.resolve, tree, reinitialize: true });
    }
    return mdPackage;
  }

  public static fromMembers(
    members: Iterable<MetadataMember>,
    options?: MetadataPackageOptions
  ): MetadataPackage {
    const mdp = new MetadataPackage(options?.registry);
    for (const member of members) {
      mdp.add(member);
    }
    return mdp;
  }

  /**
   * Deploy package components to an org. The components must be backed by source files.
   *
   * @param connection Connection to org to deploy components to.
   * @param options
   */
  public async deploy(
    connection: Connection,
    options?: MetadataDeployOptions
  ): Promise<SourceDeployResult>;
  /**
   * Deploy package components to an org. The components must be backed by source files.
   * Requires local AuthInfo from @salesforce/core, usually created after authenticating with the Salesforce CLI.
   *
   * @param username Username to deploy components with.
   * @param options
   */
  public async deploy(
    username: string,
    options?: MetadataDeployOptions
  ): Promise<SourceDeployResult>;
  public async deploy(
    auth: Connection | string,
    options?: MetadataDeployOptions
  ): Promise<SourceDeployResult> {
    if (this.getSourceComponents().size === 0) {
      throw new MetadataPackageError('error_no_source_to_deploy');
    }
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
    if (this.typeMembers.length === 0 && this.getComponents().size > 0) {
      const typeMembers: PackageTypeMembers[] = [];
      for (const [typeName, components] of this.getComponents().entries()) {
        const members: string[] = [];
        for (const { fullName } of components.values()) {
          members.push(fullName);
        }
        typeMembers.push({ members, name: typeName });
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
   * Get a collection of metadata components included in the package. Only returns component
   * FullName and Type information if source files have not yet been resolved.
   */
  public getComponents(): ComponentCollection<MetadataComponent> {
    if (this._components.size > 0) {
      return this._components;
    } else if (this._sourceComponents.size > 0) {
      return this._sourceComponents;
    } else if (this.typeMembers.length > 0) {
      this.setComponentsFromMembers();
    }
    return this._components;
  }

  /**
   * Get a collection of source-backed metadata components from the package. If source files were not
   * resolved during package initialization, returns `undefined`. To resolve components for
   * the existing package, specify the `resolve` option with a path to resolve the package against.
   * The returned collection is cached for subsequent requests unless explicitly re-resolved.
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
  public getSourceComponents(
    options?: SourceComponentOptions
  ): ComponentCollection<SourceComponent> | undefined {
    if (!options?.resolve) {
      return this._sourceComponents;
    }

    let filterSet: ComponentCollection<MetadataComponent>;

    if (options?.reinitialize) {
      this._components = new ComponentCollection<MetadataComponent>();
      this.typeMembers = [];
    } else {
      filterSet = this.getComponents();
    }

    // TODO: move filter logic to resolver and have it return ComponentCollection
    const resolver = new MetadataResolver(this.registry, options?.tree);
    const resolved = resolver.getComponentsFromPath(options.resolve);
    const sourceComponentMap = new ComponentCollection<SourceComponent>();

    for (const component of resolved) {
      if (options?.reinitialize || filterSet.has(component)) {
        sourceComponentMap.add(component);
      } else if (!options?.reinitialize) {
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
   * Create a manifest in xml format for the package (package.xml file).
   */
  public getPackageXml(indentation = 4): string {
    const indent = new Array(indentation + 1).join(' ');

    if (this.typeMembers.length === 0 && this._components.size > 0) {
      const generator = new ManifestGenerator(undefined, this.registry);
      return generator.createManifest(this.getComponents().getAll(), this.apiVersion, indent);
    }

    const j2x = new j2xParser({
      format: true,
      indentBy: indent,
      ignoreAttributes: false,
    });
    const toParse = this.getObject() as any;
    toParse.Package[XML_NS_KEY] = XML_NS_URL;
    return XML_DECL.concat(j2x.parse(toParse));
  }

  public add(members: MetadataMember): void;
  public add(components: MetadataComponent): void;
  public add(input: MetadataComponent | MetadataMember): void {
    if (typeof input.type === 'string') {
      this._components.add({
        fullName: input.fullName,
        type: this.registry.getTypeByName(input.type),
      });
    } else {
      this._components.add(input as MetadataComponent);
    }

    // invalidate cache
    this._sourceComponents = new ComponentCollection<SourceComponent>();
    this.typeMembers = [];
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
