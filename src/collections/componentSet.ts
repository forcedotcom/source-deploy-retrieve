/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  MetadataApiDeploy,
  MetadataApiDeployOptions,
  MetadataApiRetrieve,
  MetadataApiRetrieveOptions,
} from '../client';
import { XML_DECL, XML_NS_KEY, XML_NS_URL } from '../common';
import { ComponentSetError } from '../errors';
import {
  MetadataResolver,
  ManifestResolver,
  SourceComponent,
  TreeContainer,
  MetadataComponent,
  ComponentLike,
} from '../resolve';
import {
  PackageTypeMembers,
  FromManifestOptions,
  PackageManifestObject,
  FromSourceOptions,
} from './types';
import { LazyCollection } from './lazyCollection';
import { j2xParser } from 'fast-xml-parser';
import { RegistryAccess } from '../registry';

export type DeploySetOptions = Omit<MetadataApiDeployOptions, 'components'>;
export type RetrieveSetOptions = Omit<MetadataApiRetrieveOptions, 'components'>;

/**
 * A collection containing no duplicate metadata members (`fullName` and `type` pairs). `ComponentSets`
 * are a convinient way of constructing a unique collection of components to perform operations such as
 * deploying and retrieving.
 *
 * Multiple {@link SourceComponent}s can be present in the set and correspond to the same member.
 * This is typically the case when a component's source files are split across locations. For an example, see
 * the [multiple package directories](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_ws_mpd.htm)
 * scenario.
 */
export class ComponentSet extends LazyCollection<MetadataComponent> {
  public static readonly WILDCARD = '*';
  private static readonly KEY_DELIMITER = '#';
  public apiVersion: string;
  public fullName?: string;
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
   * Resolve metadata components from a file or directory path in a file system.
   *
   * @param fsPath File or directory path to resolve against
   * @returns ComponentSet of source resolved components
   */
  public static fromSource(fsPath: string): ComponentSet;
  /**
   * Resolve metadata components from multiple file paths or directory paths in a file system.
   *
   * @param fsPaths File or directory paths to resolve against
   * @returns ComponentSet of source resolved components
   */
  public static fromSource(fsPaths: string[]): ComponentSet;
  /**
   * Resolve metadata components from file or directory paths in a file system.
   * Customize the resolution process using an options object, such as specifying filters
   * and resolving against a different file system abstraction (see {@link TreeContainer}).
   *
   * @param options
   * @returns ComponentSet of source resolved components
   */
  public static fromSource(options: FromSourceOptions): ComponentSet;
  public static fromSource(input: string | string[] | FromSourceOptions): ComponentSet {
    let fsPaths = [];
    let registry: RegistryAccess;
    let tree: TreeContainer;
    let inclusiveFilter: ComponentSet;

    if (Array.isArray(input)) {
      fsPaths = input;
    } else if (typeof input === 'object') {
      fsPaths = input.fsPaths;
      registry = input.registry ?? registry;
      tree = input.tree ?? tree;
      inclusiveFilter = input.include;
    } else {
      fsPaths = [input];
    }

    const resolver = new MetadataResolver(registry, tree);
    const set = new ComponentSet([], registry);
    for (const fsPath of fsPaths) {
      for (const component of resolver.getComponentsFromPath(fsPath, inclusiveFilter)) {
        set.add(component);
      }
    }

    return set;
  }

  /**
   * Resolve components from a manifest file in XML format.
   *
   * see [Sample package.xml Manifest Files](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/manifest_samples.htm)
   *
   * @param manifestPath Path to XML file
   * @returns Promise of a ComponentSet containing manifest components
   */
  public static async fromManifest(manifestPath: string): Promise<ComponentSet>;
  /**
   * Resolve components from a manifest file in XML format.
   * Customize the resolution process using an options object. For example, resolve source-backed components
   * while using the manifest file as a filter.
   * process using an options object, such as resolving source-backed components
   * and using the manifest file as a filter.
   *
   * see [Sample package.xml Manifest Files](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/manifest_samples.htm)
   *
   * @param options
   * @returns Promise of a ComponentSet containing manifest components
   */
  public static async fromManifest(options: FromManifestOptions): Promise<ComponentSet>;
  public static async fromManifest(input: string | FromManifestOptions): Promise<ComponentSet> {
    const manifestPath = typeof input === 'string' ? input : input.manifestPath;
    const options = (typeof input === 'object' ? input : {}) as Partial<FromManifestOptions>;

    const manifestResolver = new ManifestResolver(options.tree, options.registry);
    const manifest = await manifestResolver.resolve(manifestPath);
    const resolveIncludeSet = options.resolveSourcePaths
      ? new ComponentSet([], options.registry)
      : undefined;
    const result = new ComponentSet([], options.registry);
    result.apiVersion = manifest.apiVersion;
    result.fullName = manifest.fullName;

    for (const component of manifest.components) {
      if (resolveIncludeSet) {
        resolveIncludeSet.add(component);
      }
      const memberIsWildcard = component.fullName === ComponentSet.WILDCARD;
      if (!memberIsWildcard || options.forceAddWildcards || !options.resolveSourcePaths) {
        result.add(component);
      }
    }

    if (options.resolveSourcePaths) {
      const components = ComponentSet.fromSource({
        fsPaths: options.resolveSourcePaths,
        tree: options.tree,
        include: resolveIncludeSet,
        registry: options.registry,
      });
      for (const component of components) {
        result.add(component);
      }
    }

    return result;
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
        fullName: this.fullName,
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
    const toParse = this.getObject();
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
   * - The pair is directly in the set
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
