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
  MutableComponentCollection,
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
import { deepFreeze } from '../utils/registry';

export class MetadataPackage {
  public apiVersion: string;
  private registry: RegistryAccess;
  private _components = new MutableComponentCollection<MetadataComponent>();
  private _sourceComponents = new MutableComponentCollection<SourceComponent>();

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
    mdPackage.resolveSourceComponents(fsPath, { tree: options?.tree, reinitialize: true });
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
    if (options?.resolve) {
      mdPackage.resolveSourceComponents(options.resolve, { tree, reinitialize: true });
    } else {
      for (const { name: type, members } of types) {
        for (const fullName of members) {
          mdPackage.add({ fullName, type });
        }
      }
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
    if (this._sourceComponents.size === 0) {
      throw new MetadataPackageError('error_no_source_to_deploy');
    }
    const connection = await this.getConnection(auth);
    const client = new SourceClient(connection, new MetadataResolver());
    return client.metadata.deploy(this._sourceComponents.getAll(), options);
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
    let toRetrieve: MetadataComponent[];

    if (this._sourceComponents.size > 0) {
      toRetrieve = this._sourceComponents.getAll();
    } else {
      if (this._components.size === 0) {
        throw new MetadataPackageError('error_no_source_to_retrieve');
      }
      toRetrieve = this._components.getAll();
    }

    return client.metadata.retrieve({
      // this is fine, if they aren't mergable then they'll go to the default
      components: toRetrieve as SourceComponent[],
      merge: options?.merge,
      output: options?.output,
      wait: options?.wait,
    });
  }

  /**
   * Get an object representation of the package manifest.
   */
  public getObject(): PackageManifestContents {
    const typeMembers: PackageTypeMembers[] = [];

    for (const [typeName, components] of this._components.entries()) {
      const members: string[] = [];
      for (const { fullName } of components.values()) {
        members.push(fullName);
      }
      typeMembers.push({ members, name: typeName });
    }

    return {
      Package: {
        types: typeMembers,
        version: this.apiVersion,
      },
    };
  }

  /**
   * Resolve source backed versions of the package components. Specify the `reinitialize`
   * option to resolve all components in the given path, regardless of what is in the package.
   * `reinitialize` overwrites the package state with the newly resolved components.
   *
   * @param options
   */
  public resolveSourceComponents(
    fsPath: string,
    options?: SourceComponentOptions
  ): ComponentCollection<SourceComponent> | undefined {
    let filterSet: ComponentCollection<MetadataComponent>;

    if (options?.reinitialize) {
      this._components = new MutableComponentCollection<MetadataComponent>();
    } else {
      filterSet = this._components;
    }

    // TODO: move filter logic to resolver and have it return ComponentCollection
    const resolver = new MetadataResolver(this.registry, options?.tree);
    const resolved = resolver.getComponentsFromPath(fsPath);
    this._sourceComponents = new MutableComponentCollection<SourceComponent>();

    for (const component of resolved) {
      if (options?.reinitialize || filterSet.has(component)) {
        this._sourceComponents.add(component);
        this._components.add(Object.freeze({ fullName: component.fullName, type: component.type }));
      } else if (!options?.reinitialize) {
        for (const childComponent of component.getChildren()) {
          if (filterSet.has(childComponent)) {
            this._sourceComponents.add(childComponent);
            this._components.add(
              Object.freeze({ fullName: childComponent.fullName, type: childComponent.type })
            );
          }
        }
      }
    }

    return this._sourceComponents;
  }

  /**
   * Create a manifest in xml format for the package (package.xml file).
   */
  public getPackageXml(indentation = 4): string {
    const j2x = new j2xParser({
      format: true,
      indentBy: new Array(indentation + 1).join(' '),
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
      this._components.add(
        Object.freeze({
          fullName: input.fullName,
          type: this.registry.getTypeByName(input.type),
        })
      );
    } else {
      this._components.add(Object.freeze(input) as MetadataComponent);
    }

    // invalidate cache
    // if (this._sourceComponents.size > 0) {
    //   this._sourceComponents = new MutableComponentCollection<SourceComponent>();
    // }
  }

  get components(): ComponentCollection<MetadataComponent> {
    return new ComponentCollection(this._components);
  }

  get sourceComponents(): ComponentCollection<SourceComponent> {
    return new ComponentCollection(this._sourceComponents);
  }

  private async getConnection(auth: Connection | string): Promise<Connection> {
    return auth instanceof Connection
      ? auth
      : await Connection.create({
          authInfo: await AuthInfo.create({ username: auth }),
        });
  }
}
