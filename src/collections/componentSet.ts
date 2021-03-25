/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { parse as parseXml, j2xParser } from 'fast-xml-parser';
import {
  MetadataApiDeploy,
  MetadataApiDeployOptions,
  MetadataApiRetrieve,
  MetadataApiRetrieveOptions,
} from '../client';
import { MetadataComponent, XML_DECL, XML_NS_KEY, XML_NS_URL } from '../common';
import { ComponentSetError } from '../errors';
import { NodeFSTreeContainer, RegistryAccess, SourceComponent } from '../metadata-registry';
import { PackageTypeMembers, FromManifestOptions, PackageManifestObject } from './types';
import { ComponentLike } from '../common/types';
import { LazyCollection } from './lazyCollection';
import { resolveSource } from './initializers';

export type DeploySetOptions = Omit<MetadataApiDeployOptions, 'components'>;
export type RetrieveSetOptions = Omit<MetadataApiRetrieveOptions, 'components'>;

/**
 * A collection containing no duplicate metadata members. In other words, no duplicate `fullName` and `type` pairs.
 *
 * Multiple {@link SourceComponent}s can be present in the set and correspond to the same member.
 * This is typically the case when a component's source files are split across locations, such as
 * the [multiple package directories](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_ws_mpd.htm)
 * scenario.
 *
 * `ComponentSets` are a convinient way of constructing a collection of components to perform operations such as
 * deploying and retrieving.
 */
export class ComponentSet extends LazyCollection<MetadataComponent> {
  public static readonly WILDCARD = '*';
  private static readonly KEY_DELIMITER = '#';
  public apiVersion: string;
  private registry: RegistryAccess;
  private components = new Map<string, Map<string, SourceComponent>>();

  public constructor(components: Iterable<ComponentLike> = [], registry = new RegistryAccess()) {
    super();
    this.registry = registry;
    this.apiVersion = this.registry.apiVersion;
    for (const component of components) {
      this.add(component);
    }
  }

  /**
   * Create a set by reading a manifest file in xml format. Optionally, specify a file path
   * with the `resolve` option to resolve source files for the components.
   *
   * ```
   * ComponentSet.fromManifestFile('/path/to/package.xml', {
   *  resolve: '/path/to/force-app'
   * });
   * ```
   *
   * @param fsPath Path to xml file
   * @param options
   * @returns Promise of a ComponentSet
   */
  public static async fromManifestFile(
    fsPath: string,
    options: FromManifestOptions = {}
  ): Promise<ComponentSet> {
    const registry = options.registry ?? new RegistryAccess();
    const tree = options.tree ?? new NodeFSTreeContainer();
    const shouldResolve = !!options.resolve;

    const ws = new ComponentSet(undefined, registry);
    const filterSet = new ComponentSet(undefined, registry);
    const file = await tree.readFile(fsPath);
    const manifestObj: PackageManifestObject = parseXml(file.toString(), {
      stopNodes: ['version'],
    });

    ws.apiVersion = manifestObj.Package.version;

    for (const component of ComponentSet.getComponentsFromManifestObject(manifestObj, registry)) {
      if (shouldResolve) {
        filterSet.add(component);
      }
      const memberIsWildcard = component.fullName === ComponentSet.WILDCARD;
      if (!memberIsWildcard || options?.literalWildcard || !shouldResolve) {
        ws.add(component);
      }
    }

    if (shouldResolve) {
      // if it's a string, don't iterate over the characters
      const toResolve =
        typeof options.resolve === 'string' ? [options.resolve] : Array.from(options.resolve);
      const components = resolveSource({
        fsPaths: toResolve,
        tree,
        inclusiveFilter: filterSet,
        registry,
      });
      for (const component of components) {
        ws.add(component);
      }
    }

    return ws;
  }

  private static *getComponentsFromManifestObject(
    obj: PackageManifestObject,
    registry: RegistryAccess
  ): IterableIterator<MetadataComponent> {
    const { types } = obj.Package;
    const typeMembers = Array.isArray(types) ? types : [types];
    for (const { name: typeName, members } of typeMembers) {
      const fullNames = Array.isArray(members) ? members : [members];
      for (const fullName of fullNames) {
        let type = registry.getTypeByName(typeName);
        // if there is no / delimiter and it's a type in folders, infer folder component
        if (type.folderType && !fullName.includes('/')) {
          type = registry.getTypeByName(type.folderType);
        }
        yield {
          fullName,
          type,
        };
      }
    }
  }

  /**
   * Constructs a deploy operation using the components in the set. There must be at least
   * one source-backed component in the set to create an operation.
   *
   * @param options
   * @returns Metadata API deploy operation
   */
  public deploy(options: DeploySetOptions): MetadataApiDeploy {
    const toDeploy = Array.from(this.getSourceComponents());

    if (toDeploy.length === 0) {
      throw new ComponentSetError('error_no_source_to_deploy');
    }

    const operationOptions = Object.assign({}, options, {
      components: this,
      registry: this.registry,
      apiVersion: this.apiVersion,
    });

    return new MetadataApiDeploy(operationOptions);
  }

  /**
   * Constructs a retrieve operation using the components in the set.
   *
   * @param options
   * @returns Metadata API retrieve operation
   */
  public retrieve(options: RetrieveSetOptions): MetadataApiRetrieve {
    const operationOptions = Object.assign({}, options, {
      components: this,
      registry: this.registry,
      apiVersion: this.apiVersion,
    });

    return new MetadataApiRetrieve(operationOptions);
  }

  /**
   * Get an object representation of a package manifest based on the set components.
   *
   * @returns Object representation of a package manifest
   */
  public getObject(): PackageManifestObject {
    const typeMap = new Map<string, string[]>();
    for (const key of this.components.keys()) {
      const [typeId, fullName] = key.split(ComponentSet.KEY_DELIMITER);
      let type = this.registry.getTypeByName(typeId);

      if (type.folderContentType) {
        type = this.registry.getTypeByName(type.folderContentType);
      }

      if (!typeMap.has(type.name)) {
        typeMap.set(type.name, []);
      }

      typeMap.get(type.name).push(fullName);
    }

    const typeMembers: PackageTypeMembers[] = [];
    for (const [typeName, members] of typeMap.entries()) {
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
   * Get only the source-backed metadata components in the set.
   *
   * @param member Member to retrieve source-backed components for.
   * @returns Collection of source-backed components
   */
  public getSourceComponents(member?: ComponentLike): LazyCollection<SourceComponent> {
    let iter: Iterable<MetadataComponent>;

    if (member) {
      // filter optimization
      const memberCollection = this.components.get(this.simpleKey(member));
      iter = memberCollection?.size > 0 ? memberCollection.values() : [];
    } else {
      iter = this;
    }

    return new LazyCollection(iter).filter((c) => c instanceof SourceComponent) as LazyCollection<
      SourceComponent
    >;
  }

  public add(component: ComponentLike): void {
    const key = this.simpleKey(component);
    if (!this.components.has(key)) {
      this.components.set(key, new Map<string, SourceComponent>());
    }
    if (component instanceof SourceComponent) {
      this.components.get(key).set(this.sourceKey(component), component);
    }
  }

  /**
   * Tests whether or not a `fullName` and `type` pair is present in the set.
   *
   * A pair is considered present in the set if one of the following criteria is met:
   *
   * - The pair directly in the set
   * - A wilcard component with the same `type` as the pair
   * - If a parent is attached to the pair and the parent is directly in the set
   * - If a parent is attached to the pair, and a wildcard component's `type` matches the parent's `type`
   *
   * @param component Component to test for membership in the set
   * @returns `true` if the component is in the set
   */
  public has(component: ComponentLike): boolean {
    const isDirectlyInSet = this.components.has(this.simpleKey(component));
    if (isDirectlyInSet) {
      return true;
    }

    const wildcardMember: ComponentLike = {
      fullName: ComponentSet.WILDCARD,
      type: typeof component.type === 'object' ? component.type.name : component.type,
    };
    const isIncludedInWildcard = this.components.has(this.simpleKey(wildcardMember));
    if (isIncludedInWildcard) {
      return true;
    }

    if (typeof component.type === 'object') {
      const { parent } = component as MetadataComponent;
      if (parent) {
        const parentDirectlyInSet = this.components.has(this.simpleKey(parent));
        if (parentDirectlyInSet) {
          return true;
        }

        const wildcardKey = this.simpleKey({
          fullName: ComponentSet.WILDCARD,
          type: parent.type,
        });
        const parentInWildcard = this.components.has(wildcardKey);
        if (parentInWildcard) {
          return true;
        }
      }
    }

    return false;
  }

  public *[Symbol.iterator](): Iterator<MetadataComponent> {
    for (const [key, sourceComponents] of this.components.entries()) {
      if (sourceComponents.size === 0) {
        const [typeName, fullName] = key.split(ComponentSet.KEY_DELIMITER);
        yield {
          fullName,
          type: this.registry.getTypeByName(typeName),
        };
      } else {
        for (const component of sourceComponents.values()) {
          yield component;
        }
      }
    }
  }

  /**
   * Each {@link SourceComponent} counts as an element in the set, even if multiple
   * ones map to the same `fullName` and `type` pair.
   *
   * @returns number of metadata components in the set
   */
  get size(): number {
    let size = 0;
    for (const collection of this.components.values()) {
      // just having an entry in the parent map counts as 1
      size += collection.size === 0 ? 1 : collection.size;
    }
    return size;
  }

  private sourceKey(component: SourceComponent): string {
    const { fullName, type, xml, content } = component;
    return `${type.name}${fullName}${xml ?? ''}${content ?? ''}`;
  }

  private simpleKey(component: ComponentLike): string {
    const typeName =
      typeof component.type === 'string' ? component.type.toLowerCase().trim() : component.type.id;
    return `${typeName}${ComponentSet.KEY_DELIMITER}${component.fullName}`;
  }
}
