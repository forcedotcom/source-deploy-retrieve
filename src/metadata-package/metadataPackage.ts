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
  MetadataResolver,
  NodeFSTreeContainer,
  RegistryAccess,
  SourceComponent,
} from '../metadata-registry';
import {
  MetadataComponent,
  ComponentCollection,
  XML_DECL,
  XML_NS_KEY,
  XML_NS_URL,
  MutableComponentCollection,
  ComponentSet,
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
  private _components = new MutableComponentCollection<MetadataComponent>();

  public constructor(registry = new RegistryAccess()) {
    this.registry = registry;
    this.apiVersion = registry.apiVersion;
  }

  /**
   * Create a package by resolving source backed components.
   *
   * @param fsPath Path to resolve components from
   * @param options
   */
  public static fromSource(fsPath: string, options?: FromSourceOptions): MetadataPackage {
    const mdPackage = new MetadataPackage(options?.registry);
    mdPackage.resolveSourceComponents(fsPath, { tree: options?.tree });
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
    const registry = options?.registry || new RegistryAccess();
    const tree = options?.tree || new NodeFSTreeContainer();
    const file = await tree.readFile(fsPath);
    const mdPackage = new MetadataPackage(options?.registry);
    const { types, version } = (parseXml(file.toString(), {
      stopNodes: ['version'],
      ignoreNameSpace: false,
    }) as PackageManifestContents).Package;
    mdPackage.apiVersion = version;

    const filterSet = new ComponentSet<MetadataComponent>();

    for (const packageTypeMembers of types) {
      const members = Array.isArray(packageTypeMembers.members)
        ? packageTypeMembers.members
        : [packageTypeMembers.members];
      for (const fullName of members) {
        const component: MetadataComponent = {
          fullName,
          type: registry.getTypeByName(packageTypeMembers.name),
        };
        if (options?.resolve) {
          filterSet.add(component);
        } else {
          mdPackage.add(component);
        }
      }
    }

    if (options?.resolve) {
      mdPackage.resolveSourceComponents(options.resolve, {
        tree,
        filter: filterSet,
      });
    }

    return mdPackage;
  }

  /**
   * Create a package by specifying a collection of Type name/FullName objects
   *
   * @param members Collection of FullName and Type name objects
   * @param options
   */
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
   * @param connection Connection to org to deploy to.
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
    const toDeploy: SourceComponent[] = [];
    for (const component of this._components.iter()) {
      if (component instanceof SourceComponent) {
        toDeploy.push(component);
      }
    }

    if (toDeploy.length === 0) {
      throw new MetadataPackageError('error_no_source_to_deploy');
    }

    const connection = await this.getConnection(auth);
    const client = new SourceClient(connection, new MetadataResolver());
    return client.metadata.deploy(toDeploy, options);
  }

  /**
   * Retrieve package components from an org. Package components are not required to be backed by
   * source files. Requires local AuthInfo from @salesforce/core, usually created after authenticating
   * with the Salesforce CLI.
   *
   * @param connection Connection to org to retrieve from.
   * @param output Directory to retrieve to.
   * @param options
   */
  public async retrieve(
    connection: Connection,
    output: string,
    options?: { merge?: boolean; wait?: number }
  ): Promise<SourceRetrieveResult>;
  /**
   * Retrieve package components from an org. Package components are not required to be backed by
   * source files.
   *
   * @param username Username of org to retrieve from.
   * @param output Directory to retrieve to
   * @param options
   */
  public async retrieve(
    username: string,
    output: string,
    options?: { merge?: boolean; wait?: number }
  ): Promise<SourceRetrieveResult>;
  public async retrieve(
    auth: Connection | string,
    output: string,
    options?: { merge?: boolean; wait?: number }
  ): Promise<SourceRetrieveResult> {
    const connection = await this.getConnection(auth);
    const client = new SourceClient(connection, new MetadataResolver());

    if (this._components.size === 0) {
      throw new MetadataPackageError('error_no_source_to_retrieve');
    }

    return client.metadata.retrieve({
      // this is fine, if they aren't mergable then they'll go to the default
      components: Array.from(this._components.iter()) as SourceComponent[],
      merge: options?.merge,
      output,
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
   * Resolve source backed components and add them to the package.
   *
   * @param fsPath: File path to resolve
   * @param options
   */
  public resolveSourceComponents(
    fsPath: string,
    options?: SourceComponentOptions
  ): ComponentCollection<SourceComponent> | undefined {
    let filterSet: ComponentSet<MetadataComponent>;

    if (options?.filter) {
      filterSet =
        options.filter instanceof ComponentSet ? options.filter : new ComponentSet(options.filter);
    }

    // TODO: move filter logic to resolver and have it return ComponentCollection
    const resolver = new MetadataResolver(this.registry, options?.tree);
    const resolved = resolver.getComponentsFromPath(fsPath);
    const sourceComponents = new MutableComponentCollection<SourceComponent>();

    for (const component of resolved) {
      if (!filterSet || filterSet.has(component)) {
        this._components.add(component);
        sourceComponents.add(component);
      } else if (filterSet) {
        for (const childComponent of component.getChildren()) {
          if (filterSet.has(childComponent)) {
            this._components.add(childComponent);
            sourceComponents.add(childComponent);
          }
        }
      }
    }

    return new ComponentCollection<SourceComponent>(sourceComponents);
  }

  /**
   * Create a manifest in xml format for the package (package.xml file).
   *
   * @param indentation Number of spaces to indent lines by.
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
  }

  get components(): ComponentCollection<MetadataComponent> {
    return new ComponentCollection(this._components);
  }

  private async getConnection(auth: Connection | string): Promise<Connection> {
    return auth instanceof Connection
      ? auth
      : await Connection.create({
          authInfo: await AuthInfo.create({ username: auth }),
        });
  }
}
