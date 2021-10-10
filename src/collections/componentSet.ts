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
  ComponentLike,
  ManifestResolver,
  MetadataComponent,
  MetadataResolver,
  ConnectionResolver,
  SourceComponent,
  TreeContainer,
} from '../resolve';
import {
  DestructiveChangesType,
  FromManifestOptions,
  FromSourceOptions,
  FromConnectionOptions,
  PackageManifestObject,
  PackageTypeMembers,
} from './types';
import { LazyCollection } from './lazyCollection';
import { j2xParser } from 'fast-xml-parser';
import { Connection, Logger } from '@salesforce/core';
import { MetadataType, RegistryAccess } from '../registry';

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
  /**
   * The metadata API version to use. E.g., 52.0
   */
  public apiVersion: string;
  /**
   * The metadata API version of the deployed/retrieved source.
   * This is used as the value for the `version` field in the manifest.
   */
  public sourceApiVersion: string;
  public fullName?: string;
  public forceIgnoredPaths?: Set<string>;
  private logger: Logger;
  private registry: RegistryAccess;
  private components = new Map<string, Map<string, SourceComponent>>();

  // internal component maps used by this.getObject() when building manifests.
  private destructiveComponents = new Map<string, Map<string, SourceComponent>>();
  private manifestComponents = new Map<string, Map<string, SourceComponent>>();

  private destructiveChangesType = DestructiveChangesType.POST;

  public constructor(components: Iterable<ComponentLike> = [], registry = new RegistryAccess()) {
    super();
    this.registry = registry;
    this.apiVersion = this.registry.apiVersion;
    this.logger = Logger.childFromRoot(this.constructor.name);

    for (const component of components) {
      let asDeletion = false;
      if (component instanceof SourceComponent) {
        asDeletion = component.isMarkedForDelete();
      }
      this.add(component, asDeletion);
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
    let fsDeletePaths: string[] = [];

    if (Array.isArray(input)) {
      fsPaths = input;
    } else if (typeof input === 'object') {
      fsPaths = input.fsPaths;
      registry = input.registry ?? registry;
      tree = input.tree ?? tree;
      inclusiveFilter = input.include;
      fsDeletePaths = input.fsDeletePaths ?? fsDeletePaths;
    } else {
      fsPaths = [input];
    }

    const resolver = new MetadataResolver(registry, tree);
    const set = new ComponentSet([], registry);
    const buildComponents = (paths: string[], asDeletes: boolean): void => {
      for (const path of paths) {
        for (const component of resolver.getComponentsFromPath(path, inclusiveFilter)) {
          set.add(component, asDeletes);
        }
      }
    };
    buildComponents(fsPaths, false);
    buildComponents(fsDeletePaths, true);

    set.forceIgnoredPaths = resolver.forceIgnoredPaths;

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
      result.forceIgnoredPaths = components.forceIgnoredPaths;
      for (const component of components) {
        result.add(component);
      }
    }

    return result;
  }

  /**
   * Resolve components from an org connection.
   *
   * @param connection org connection
   * @returns ComponentSet of source resolved components
   */
  public static async fromConnection(connection: Connection): Promise<ComponentSet>;
  /**
   * Resolve components from an org connection.
   *
   * @param options
   * @returns ComponentSet of source resolved components
   */
  public static async fromConnection(options: FromConnectionOptions): Promise<ComponentSet>;
  public static async fromConnection(
    input: Connection | FromConnectionOptions
  ): Promise<ComponentSet> {
    const connection = input instanceof Connection ? input : input.connection;
    const options = (typeof input === 'object' ? input : {}) as Partial<FromConnectionOptions>;

    const connectionResolver = new ConnectionResolver(connection, options.registry);
    const manifest = await connectionResolver.resolve();
    const result = new ComponentSet([], options.registry);

    for (const component of manifest.components) {
      result.add(component);
    }

    return result;
  }

  /**
   * Constructs a deploy operation using the components in the set and starts
   * the deployment. There must be at least one source-backed component in
   * the set to create an operation.
   *
   * @param options
   * @returns Metadata API deploy operation
   */
  public async deploy(options: DeploySetOptions): Promise<MetadataApiDeploy> {
    const toDeploy = Array.from(this.getSourceComponents());

    if (toDeploy.length === 0) {
      throw new ComponentSetError('error_no_source_to_deploy');
    }

    const operationOptions = Object.assign({}, options, {
      components: this,
      registry: this.registry,
      apiVersion: this.apiVersion,
    });

    const mdapiDeploy = new MetadataApiDeploy(operationOptions);
    await mdapiDeploy.start();
    return mdapiDeploy;
  }

  /**
   * Constructs a retrieve operation using the components in the set and
   * starts the retrieval.
   *
   * @param options
   * @returns Metadata API retrieve operation
   */
  public async retrieve(options: RetrieveSetOptions): Promise<MetadataApiRetrieve> {
    const operationOptions = Object.assign({}, options, {
      components: this,
      registry: this.registry,
      apiVersion: this.apiVersion,
    });

    const mdapiRetrieve = new MetadataApiRetrieve(operationOptions);
    await mdapiRetrieve.start();
    return mdapiRetrieve;
  }

  /**
   * Get an object representation of a package manifest based on the set components.
   *
   * @returns Object representation of a package manifest
   */
  public getObject(forDestructiveChanges = false): PackageManifestObject {
    // If this ComponentSet has components marked for delete, we need to
    // only include those components in a destructiveChanges.xml and
    // all other components in the regular manifest.
    let components = this.components;
    if (this.hasDeletes) {
      if (forDestructiveChanges) {
        components = this.destructiveComponents;
      } else {
        components = this.manifestComponents;
      }
    }

    const typeMap = new Map<string, string[]>();

    const addToTypeMap = (type: MetadataType, fullName: string): void => {
      if (type.isAddressable !== false) {
        const typeName = type.name;
        if (!typeMap.has(typeName)) {
          typeMap.set(typeName, []);
        }
        const typeEntry = typeMap.get(typeName);
        if (fullName === ComponentSet.WILDCARD && !type.supportsWildcardAndName) {
          // if the type doesn't support mixed wildcards and specific names, overwrite the names to be a wildcard
          typeMap.set(typeName, [fullName]);
        } else if (
          !typeEntry.includes(fullName) &&
          (!typeEntry.includes(ComponentSet.WILDCARD) || type.supportsWildcardAndName)
        ) {
          // if the type supports both wildcards and names, add them regardless
          typeMap.get(typeName).push(fullName);
        }
      }
    };

    for (const key of components.keys()) {
      const [typeId, fullName] = key.split(ComponentSet.KEY_DELIMITER);
      let type = this.registry.getTypeByName(typeId);

      if (type.folderContentType) {
        type = this.registry.getTypeByName(type.folderContentType);
      }
      addToTypeMap(type, fullName);

      // Add children
      const componentMap = components.get(key);
      for (const comp of componentMap.values()) {
        for (const child of comp.getChildren()) {
          addToTypeMap(child.type, child.fullName);
        }
      }
    }

    const typeMembers: PackageTypeMembers[] = [];
    for (const [typeName, members] of typeMap.entries()) {
      typeMembers.push({ members, name: typeName });
    }

    return {
      Package: {
        types: typeMembers,
        version: this.sourceApiVersion || this.apiVersion,
        fullName: this.fullName,
      },
    };
  }

  /**
   * Create a manifest in xml format based on the set components and the
   * type of manifest to create.
   *
   * E.g. package.xml or destructiveChanges.xml
   *
   * @param indentation Number of spaces to indent lines by.
   * @param forDestructiveChanges Whether to build a manifest for destructive changes.
   */
  public getPackageXml(indentation = 4, forDestructiveChanges = false): string {
    const j2x = new j2xParser({
      format: true,
      indentBy: new Array(indentation + 1).join(' '),
      ignoreAttributes: false,
    });
    const toParse = this.getObject(forDestructiveChanges);
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

  public add(component: ComponentLike, asDeletion?: boolean): void {
    const key = this.simpleKey(component);
    if (!this.components.has(key)) {
      this.components.set(key, new Map<string, SourceComponent>());
    }
    if (component instanceof SourceComponent) {
      this.components.get(key).set(this.sourceKey(component), component);

      // Build maps of destructive components and regular components as they are added
      // as an optimization when building manifests.
      if (asDeletion) {
        component.setMarkedForDelete(true);
        this.logger.debug(`Marking component for delete: ${component.fullName}`);
        if (!this.destructiveComponents.has(key)) {
          this.destructiveComponents.set(key, new Map<string, SourceComponent>());
        }
        this.destructiveComponents.get(key).set(this.sourceKey(component), component);
      } else {
        if (!this.manifestComponents.has(key)) {
          this.manifestComponents.set(key, new Map<string, SourceComponent>());
        }
        this.manifestComponents.get(key).set(this.sourceKey(component), component);
      }
    }
  }

  /**
   * Tests whether or not a `fullName` and `type` pair is present in the set.
   *
   * A pair is considered present in the set if one of the following criteria is met:
   *
   * - The pair is directly in the set
   * - A wildcard component with the same `type` as the pair
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
   * If this `ComponentSet` has components marked for delete, this sets
   * whether those components are deleted before any other changes are
   * deployed (`destructiveChangesPre.xml`) or after changes are deployed
   * (`destructiveChangesPost.xml`).
   *
   * @param type The type of destructive changes to make; i.e., pre or post deploy.
   */
  public setDestructiveChangesType(type: DestructiveChangesType): void {
    this.destructiveChangesType = type;
  }

  /**
   * If this `ComponentSet` has components marked for delete it will use this
   * type to build the appropriate destructive changes manifest.
   *
   * @returns The type of destructive changes to make; i.e., pre or post deploy.
   */
  public getDestructiveChangesType(): DestructiveChangesType {
    return this.destructiveChangesType;
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

  /**
   * Returns `true` if this `ComponentSet` contains components marked for deletion.
   */
  get hasDeletes(): boolean {
    return this.destructiveComponents.size > 0;
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
