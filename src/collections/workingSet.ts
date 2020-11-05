/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection } from '@salesforce/core';
import { parse as parseXml, j2xParser } from 'fast-xml-parser';
import { ComponentSet } from './componentSet';
import { SourceClient } from '../client';
import { MetadataDeployOptions, SourceDeployResult, SourceRetrieveResult } from '../client/types';
import { MetadataComponent, XML_DECL, XML_NS_KEY, XML_NS_URL } from '../common';
import { WorkingSetError } from '../errors';
import { nls } from '../i18n';
import {
  MetadataResolver,
  NodeFSTreeContainer,
  RegistryAccess,
  SourceComponent,
} from '../metadata-registry';
import {
  PackageTypeMembers,
  FromSourceOptions,
  FromManifestOptions,
  PackageManifestObject,
  SourceComponentOptions,
  MetadataMember,
  WorkingSetOptions,
} from './types';

export class WorkingSet implements Iterable<MetadataComponent> {
  public apiVersion: string;
  private registry: RegistryAccess;
  private _components = new Map<string, ComponentSet<MetadataComponent>>();

  public constructor(registry = new RegistryAccess()) {
    this.registry = registry;
    this.apiVersion = registry.apiVersion;
  }

  /**
   * Create a set by resolving components from source.
   *
   * @param fsPath Path to resolve components from
   * @param options
   */
  public static fromSource(fsPath: string, options?: FromSourceOptions): WorkingSet {
    const ws = new WorkingSet(options?.registry);
    ws.resolveSourceComponents(fsPath, { tree: options?.tree });
    return ws;
  }

  /**
   * Create a set by reading a manifest file in xml format. Optionally, specify a file path
   * with the `resolve` option to resolve source files for the components.
   *
   * ```
   * WorkingSet.fromManifest('/path/to/package.xml', {
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
  ): Promise<WorkingSet> {
    const registry = options?.registry ?? new RegistryAccess();
    const tree = options?.tree ?? new NodeFSTreeContainer();
    const file = await tree.readFile(fsPath);
    const ws = new WorkingSet(options?.registry);
    const { types, version } = (parseXml(file.toString(), {
      stopNodes: ['version'],
      ignoreNameSpace: false,
    }) as PackageManifestObject).Package;
    ws.apiVersion = version;

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
          ws.add(component);
        }
      }
    }

    if (options?.resolve) {
      ws.resolveSourceComponents(options.resolve, {
        tree,
        filter: filterSet,
      });
    }

    return ws;
  }

  /**
   * Create a set from a collection of components or type members.
   *
   * @param collection
   * @param options
   */
  public static fromComponents(
    collection: Iterable<MetadataComponent> | Iterable<MetadataMember>,
    options?: WorkingSetOptions
  ): WorkingSet {
    const ws = new WorkingSet(options?.registry);
    for (const component of collection) {
      ws.add(component);
    }
    return ws;
  }

  /**
   * Deploy components in the set to an org. The components must be backed by source files.
   * Deploying with a username requires local AuthInfo from @salesforce/core, usually created
   * after authenticating with the Salesforce CLI.
   *
   * @param usernameOrConnection Username or connection to deploy components with.
   * @param options
   */
  public async deploy(
    usernameOrConnection: string | Connection,
    options?: MetadataDeployOptions
  ): Promise<SourceDeployResult> {
    const toDeploy: SourceComponent[] = [];
    const missingSource: string[] = [];

    for (const component of this) {
      if (component instanceof SourceComponent) {
        toDeploy.push(component);
      } else {
        missingSource.push(`${component.type.name}:${component.fullName}`);
      }
    }

    if (toDeploy.length === 0) {
      throw new WorkingSetError('error_no_source_to_deploy');
    } else if (missingSource.length > 0) {
      console.warn(nls.localize('warn_unresolved_source_for_components', missingSource.join(',')));
    }

    const connection = await this.getConnection(usernameOrConnection);
    const client = new SourceClient(connection, new MetadataResolver());

    return client.metadata.deploy(toDeploy, options);
  }

  /**
   * Retrieve components in the set from an org. Components are not required to be backed by
   * source files. Retrieving with a username requires local AuthInfo from @salesforce/core,
   * usually created after authenticating with the Salesforce CLI.
   *
   * @param usernameOrConnection Username or Connection to retrieve with.
   * @param output Directory to retrieve to.
   * @param options
   */
  public async retrieve(
    usernameOrConnection: string | Connection,
    output: string,
    options?: { merge?: boolean; wait?: number }
  ): Promise<SourceRetrieveResult> {
    const connection = await this.getConnection(usernameOrConnection);
    const client = new SourceClient(connection, new MetadataResolver());

    if (this._components.size === 0) {
      throw new WorkingSetError('error_no_components_to_retrieve');
    }

    return client.metadata.retrieve({
      // this is fine, if they aren't mergable then they'll go to the default
      components: Array.from(this) as SourceComponent[],
      merge: options?.merge,
      output,
      wait: options?.wait,
    });
  }

  /**
   * Get an object representation of a package manifest based on the set components.
   */
  public getObject(): PackageManifestObject {
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
   * Resolve source backed components and add them to the set.
   *
   * @param fsPath: File path to resolve
   * @param options
   */
  public resolveSourceComponents(
    fsPath: string,
    options?: SourceComponentOptions
  ): ComponentSet<SourceComponent> | undefined {
    let filterSet: ComponentSet<MetadataComponent>;

    if (options?.filter) {
      const { filter } = options;
      filterSet = filter instanceof ComponentSet ? filter : new ComponentSet(filter);
    }

    // TODO: move filter logic to resolver W-8023153
    const resolver = new MetadataResolver(this.registry, options?.tree);
    const resolved = resolver.getComponentsFromPath(fsPath);
    const sourceComponents = new ComponentSet<SourceComponent>();

    for (const component of resolved) {
      if (!filterSet || filterSet.has(component)) {
        this.setComponent(component);
        sourceComponents.add(component);
      } else if (filterSet) {
        for (const childComponent of component.getChildren()) {
          if (filterSet.has(childComponent)) {
            this.setComponent(childComponent);
            sourceComponents.add(childComponent);
          }
        }
      }
    }

    return sourceComponents;
  }

  /**
   * Create a manifest in xml format (package.xml) based on the set components.
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

  /**
   * Add a component to the set.
   *
   * @param component
   */
  public add(component: MetadataComponent | MetadataMember): void {
    if (typeof component.type === 'string') {
      this.setComponent({
        fullName: component.fullName,
        type: this.registry.getTypeByName(component.type),
      });
    } else {
      this.setComponent(component as MetadataComponent);
    }
  }

  /**
   * Get the set entries grouped by metadata type name.
   *
   * entry -> [type name, component set]
   */
  public entries(): IterableIterator<[string, ComponentSet<MetadataComponent>]> {
    return this._components.entries();
  }

  public *[Symbol.iterator](): Iterator<MetadataComponent> {
    for (const componentSet of this._components.values()) {
      for (const component of componentSet) {
        yield component;
      }
    }
  }

  get size(): number {
    let count = 0;
    for (const set of this._components.values()) {
      count += set.size;
    }
    return count;
  }

  private async getConnection(auth: Connection | string): Promise<Connection> {
    return auth instanceof Connection
      ? auth
      : await Connection.create({
          authInfo: await AuthInfo.create({ username: auth }),
        });
  }

  private setComponent(component: MetadataComponent): void {
    const { type } = component;
    if (!this._components.has(type.name)) {
      this._components.set(type.name, new ComponentSet<MetadataComponent>());
    }
    this._components.get(type.name).add(Object.freeze(component));
  }
}
