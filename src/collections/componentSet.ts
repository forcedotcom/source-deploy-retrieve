/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* eslint  @typescript-eslint/unified-signatures:0 */
import { XMLBuilder } from 'fast-xml-parser';
import {
  AuthInfo,
  ConfigAggregator,
  Connection,
  Logger,
  Messages,
  OrgConfigProperties,
  SfError,
  SfProject,
} from '@salesforce/core';
import { isString } from '@salesforce/ts-types';
import { objectHasSomeRealValues } from '../utils/decomposed';
import { MetadataApiDeploy, MetadataApiDeployOptions } from '../client/metadataApiDeploy';
import { MetadataApiRetrieve } from '../client/metadataApiRetrieve';
import type { MetadataApiRetrieveOptions } from '../client/types';
import { XML_DECL, XML_NS_KEY, XML_NS_URL } from '../common/constants';
import { SourceComponent } from '../resolve/sourceComponent';
import { MetadataResolver } from '../resolve/metadataResolver';
import { ConnectionResolver } from '../resolve/connectionResolver';
import { ManifestResolver } from '../resolve/manifestResolver';
import { ComponentLike, MetadataComponent, MetadataMember } from '../resolve/types';
import { RegistryAccess } from '../registry/registryAccess';
import { getCurrentApiVersion } from '../registry/coverage';
import { MetadataType } from '../registry/types';
import {
  DestructiveChangesType,
  FromConnectionOptions,
  FromManifestOptions,
  FromSourceOptions,
  PackageManifestObject,
} from './types';
import { LazyCollection } from './lazyCollection';
import { DecodeableMap } from './decodeableMap';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

export type DeploySetOptions = Omit<MetadataApiDeployOptions, 'components'>;
export type RetrieveSetOptions = Omit<MetadataApiRetrieveOptions, 'components'>;

const KEY_DELIMITER = '#';

export type SimpleKeyString = `${string}#${string}`;

/**
 * A collection containing no duplicate metadata members (`fullName` and `type` pairs). `ComponentSets`
 * are a convenient way of constructing a unique collection of components to perform operations such as
 * deploying and retrieving.
 *
 * Multiple {@link SourceComponent}s can be present in the set and correspond to the same member.
 * This is typically the case when a component's source files are split across locations. For an example, see
 * the [multiple package directories](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_ws_mpd.htm)
 * scenario.
 */
export class ComponentSet extends LazyCollection<MetadataComponent> {
  public static readonly WILDCARD = '*';
  /**
   * The metadata API version to use. E.g., 52.0
   */
  public apiVersion?: string;
  /**
   * The metadata API version of the deployed/retrieved source.
   * This is used as the value for the `version` field in the manifest.
   */
  public sourceApiVersion?: string;
  /**
   * Used to explicitly set the project directory for the component set.
   * When not present, sfdx-core's SfProject will use the current working directory.
   */
  public projectDirectory?: string;
  public fullName?: string;
  public forceIgnoredPaths?: Set<string>;
  public botVersionFilters?: Array<{ botName: string; versionFilter: 'all' | 'highest' | number }>;
  private logger: Logger;
  private readonly registry: RegistryAccess;
  // all components stored here, regardless of what manifest they belong to
  private components = new DecodeableMap<string, DecodeableMap<string, SourceComponent>>();

  // whether this component set is being used for a deploy
  // @ts-expect-error this is currently not used but could be used in the future
  private forDeploy = false;
  // whether this component set is being used for a retrieve
  private forRetrieve = false;

  // internal component maps used by this.getObject() when building manifests.
  private destructiveComponents = {
    [DestructiveChangesType.PRE]: new DecodeableMap<string, DecodeableMap<string, SourceComponent>>(),
    [DestructiveChangesType.POST]: new DecodeableMap<string, DecodeableMap<string, SourceComponent>>(),
  };
  // used to store components meant for a "constructive" (not destructive) manifest
  private manifestComponents = new DecodeableMap<string, DecodeableMap<string, SourceComponent>>();

  // optimization: track AiAuthoringBundles separately for faster access during compilation check
  private aiAuthoringBundles = new Set<SourceComponent>();

  private destructiveChangesType = DestructiveChangesType.POST;

  public constructor(components: Iterable<ComponentLike> = [], registry = new RegistryAccess()) {
    super();
    this.registry = registry;
    this.logger = Logger.childFromRoot(this.constructor.name);

    for (const component of components) {
      const destructiveType =
        component instanceof SourceComponent ? component.getDestructiveChangesType() : this.destructiveChangesType;

      this.add(component, destructiveType);
    }
  }

  /**
   * Each {@link SourceComponent} counts as an element in the set, even if multiple
   * ones map to the same `fullName` and `type` pair.
   *
   * @returns number of metadata components in the set
   */
  public get size(): number {
    let size = 0;
    for (const collection of this.components.values()) {
      // just having an entry in the parent map counts as 1
      size += collection.size === 0 ? 1 : collection.size;
    }
    return size;
  }

  public get destructiveChangesPre(): DecodeableMap<string, DecodeableMap<string, SourceComponent>> {
    return this.destructiveComponents[DestructiveChangesType.PRE];
  }

  public get destructiveChangesPost(): DecodeableMap<string, DecodeableMap<string, SourceComponent>> {
    return this.destructiveComponents[DestructiveChangesType.POST];
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
    const parseFromSourceInputs = (given: string | string[] | FromSourceOptions): FromSourceOptions => {
      if (Array.isArray(given)) {
        return { fsPaths: given };
      } else if (typeof given === 'object') {
        return given;
      } else {
        return { fsPaths: [given] };
      }
    };
    const { fsPaths, registry, tree, include, fsDeletePaths = [] } = parseFromSourceInputs(input);

    const resolver = new MetadataResolver(registry, tree);
    const set = new ComponentSet([], registry);
    const buildComponents = (paths: string[], destructiveType?: DestructiveChangesType): void => {
      for (const path of paths) {
        for (const component of resolver.getComponentsFromPath(path, include)) {
          set.add(component, destructiveType);
        }
      }
    };
    buildComponents(fsPaths);
    buildComponents(fsDeletePaths, DestructiveChangesType.POST);

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

    const resolveIncludeSet = options.resolveSourcePaths ? new ComponentSet([], options.registry) : undefined;
    const resolvePostSet = options.resolveSourcePaths ? new ComponentSet([], options.registry) : undefined;
    const resolvePreSet = options.resolveSourcePaths ? new ComponentSet([], options.registry) : undefined;
    const result = new ComponentSet([], options.registry);

    result.logger.debug(`Setting sourceApiVersion of ${manifest.apiVersion} on ComponentSet from manifest`);
    result.sourceApiVersion = manifest.apiVersion;
    result.fullName = manifest.fullName;

    const addComponent = (component: MetadataComponent, deletionType?: DestructiveChangesType): void => {
      if (resolveIncludeSet && !deletionType) {
        resolveIncludeSet.add(component);
      }
      if (resolvePreSet && deletionType === DestructiveChangesType.PRE) {
        resolvePreSet.add(component, DestructiveChangesType.PRE);
      }
      if (resolvePostSet && deletionType === DestructiveChangesType.POST) {
        resolvePostSet.add(component, DestructiveChangesType.POST);
      }
      const memberIsWildcard = component.fullName === ComponentSet.WILDCARD;
      if (options.resolveSourcePaths === undefined || !memberIsWildcard || options.forceAddWildcards) {
        result.add(component, deletionType);
      }
    };

    const resolveDestructiveChanges = async (
      path: string,
      destructiveChangeType: DestructiveChangesType
    ): Promise<void> => {
      const destructiveManifest = await manifestResolver.resolve(path);
      for (const comp of destructiveManifest.components) {
        addComponent(new SourceComponent({ type: comp.type, name: comp.fullName }), destructiveChangeType);
      }
    };

    if (options.destructivePre) {
      await resolveDestructiveChanges(options.destructivePre, DestructiveChangesType.PRE);
    }
    if (options.destructivePost) {
      await resolveDestructiveChanges(options.destructivePost, DestructiveChangesType.POST);
    }

    for (const component of manifest.components) {
      addComponent(component);
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

      // if there was nothing in the resolveIncludeSet, then we can be missing information that we display to the user for deletes
      if (resolveIncludeSet?.size === 0) {
        const preCS = ComponentSet.fromSource({
          fsPaths: options.resolveSourcePaths,
          tree: options.tree,
          include: resolvePreSet,
          registry: options.registry,
        });
        for (const component of preCS) {
          result.add(component, DestructiveChangesType.PRE);
        }

        const postCS = ComponentSet.fromSource({
          fsPaths: options.resolveSourcePaths,
          tree: options.tree,
          include: resolvePostSet,
          registry: options.registry,
        });
        for (const component of postCS) {
          result.add(component, DestructiveChangesType.POST);
        }
      }
    }

    return result;
  }

  /**
   * Resolve components from an org connection.
   *
   * @param username org connection username
   * @returns ComponentSet of source resolved components
   */
  public static async fromConnection(username: string): Promise<ComponentSet>;
  /**
   * Resolve components from an org connection.
   *
   * @param options
   * @returns ComponentSet of source resolved components
   */
  public static async fromConnection(options: FromConnectionOptions): Promise<ComponentSet>;
  public static async fromConnection(input: string | FromConnectionOptions): Promise<ComponentSet> {
    let usernameOrConnection = typeof input === 'string' ? input : input.usernameOrConnection;
    const options = (typeof input === 'object' ? input : {}) as Partial<FromConnectionOptions>;

    if (typeof usernameOrConnection === 'string') {
      usernameOrConnection = await Connection.create({
        authInfo: await AuthInfo.create({ username: usernameOrConnection }),
      });
      if (options.apiVersion && options.apiVersion !== usernameOrConnection.version) {
        usernameOrConnection.setApiVersion(options.apiVersion);
      }
    }

    const connectionResolver = new ConnectionResolver(usernameOrConnection, options.registry, options.metadataTypes);
    const manifest = await connectionResolver.resolve(options.componentFilter);
    const result = new ComponentSet([], options.registry);
    result.apiVersion = manifest.apiVersion;

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
      throw new SfError(messages.getMessage('error_no_source_to_deploy'), 'ComponentSetError');
    }

    this.forDeploy = true;

    if (
      typeof options.usernameOrConnection !== 'string' &&
      this.apiVersion &&
      this.apiVersion !== options.usernameOrConnection.version
    ) {
      options.usernameOrConnection.setApiVersion(this.apiVersion);
      this.logger.debug(
        `Received conflicting apiVersion values for deploy. Using option=${this.apiVersion}, Ignoring apiVersion on connection=${options.usernameOrConnection.version}.`
      );
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
      botVersionFilters: this.botVersionFilters,
    });

    this.forRetrieve = true;

    if (
      typeof options.usernameOrConnection !== 'string' &&
      this.apiVersion &&
      this.apiVersion !== options.usernameOrConnection.version
    ) {
      options.usernameOrConnection.setApiVersion(this.apiVersion);
      this.logger.debug(
        `Received conflicting apiVersion values for retrieve. Using option=${this.apiVersion}, Ignoring apiVersion on connection=${options.usernameOrConnection.version}.`
      );
    }

    const mdapiRetrieve = new MetadataApiRetrieve(operationOptions);
    await mdapiRetrieve.start();
    return mdapiRetrieve;
  }

  /**
   * Get an object representation of a package manifest based on the set components.
   *
   * @param destructiveType Optional value for generating objects representing destructive change manifests
   * @returns Object representation of a package manifest
   */
  public async getObject(destructiveType?: DestructiveChangesType): Promise<PackageManifestObject> {
    // If this ComponentSet has components marked for delete, we need to
    // only include those components in a destructiveChanges.xml and
    // all other components in the regular manifest.
    const components = this.getTypesOfDestructiveChanges().length
      ? destructiveType
        ? this.destructiveComponents[destructiveType]
        : this.manifestComponents
      : this.components;

    const typeMap = new Map<string, Set<string>>();

    [...components.entries()].map(([key, cmpMap]) => {
      const [typeId, fullName] = splitOnFirstDelimiter(key);
      const type = this.registry.getTypeByName(typeId);

      // Add children
      [...(cmpMap?.values() ?? [])]
        .flatMap((c) => c.getChildren())
        .map((child) => addToTypeMap({ typeMap, type: child.type, fullName: child.fullName, destructiveType }));

      // logic: if this is a decomposed type not being retrieved, skip its inclusion in the manifest if the parent is "empty"
      if (
        !this.forRetrieve &&
        type.strategies?.transformer === 'decomposed' &&
        // exclude (ex: CustomObjectTranslation) where there are no addressable children
        Object.values(type.children?.types ?? {}).some((t) => t.unaddressableWithoutParent !== true) &&
        Object.values(type.children?.types ?? {}).some((t) => t.isAddressable !== false)
      ) {
        const parentComp = [...(cmpMap?.values() ?? [])].find((c) => c.fullName === fullName);
        if (parentComp?.xml && !objectHasSomeRealValues(type)(parentComp.parseXmlSync())) {
          return;
        }
      }

      addToTypeMap({
        typeMap,
        type: type.folderContentType ? this.registry.getTypeByName(type.folderContentType) : type,
        fullName: constructFullName(this.registry, type, fullName),
        destructiveType,
      });
    });

    const typeMembers = Array.from(typeMap.entries())
      .map(([typeName, members]) => ({ members: [...members].sort(), name: typeName }))
      .sort((a, b) => (a.name > b.name ? 1 : -1));

    return {
      Package: {
        ...{
          types: typeMembers,
          version: await this.getApiVersion(),
        },
        ...(this.fullName ? { fullName: this.fullName } : {}),
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
   * @param destructiveType What type of destructive manifest to build.
   */
  public async getPackageXml(indentation = 4, destructiveType?: DestructiveChangesType): Promise<string> {
    const builder = new XMLBuilder({
      format: true,
      indentBy: ''.padEnd(indentation, ' '),
      ignoreAttributes: false,
    });
    const toParse = await this.getObject(destructiveType);
    toParse.Package[XML_NS_KEY] = XML_NS_URL;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return XML_DECL.concat(builder.build(toParse));
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
      const memberCollection = this.components.get(simpleKey(member));
      iter = memberCollection && memberCollection.size > 0 ? memberCollection.values() : [];
    } else {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      iter = this;
    }

    return new LazyCollection(iter).filter((c) => c instanceof SourceComponent) as LazyCollection<SourceComponent>;
  }

  /**
   * Get all constructive AiAuthoringBundle components in the set, which require compilation before deploy.
   * This is an optimized method that uses a cached Set of AAB components.
   *
   * @returns Collection of AiAuthoringBundle source components
   */
  public getAiAuthoringBundles(): LazyCollection<SourceComponent> {
    return new LazyCollection(this.aiAuthoringBundles);
  }

  public add(component: ComponentLike, deletionType?: DestructiveChangesType): void {
    const key = simpleKey(component);
    if (!this.components.has(key)) {
      this.components.set(key, new DecodeableMap<string, SourceComponent>());
    }

    if (!deletionType && typeof component.type !== 'string') {
      // this component is meant to be added to manifestComponents, even if it's not a fully validated source component,
      // this ensures when getObject is called, we created consistent manifests  whether using this.components, or this.manifestComponents
      // when no destructive changes are present, we use this.components (not fully validated as source components, so typos end up in the generated manifest)
      // when destructive changes are used, we use this.manifestComponents (fully validated, would not match this.components)
      // this ensures this.components manifest === this.manifestComponents manifest
      const sc = new SourceComponent({ type: component.type, name: component.fullName });
      const srcKey = sourceKey(sc);

      if (!this.manifestComponents.has(key)) {
        this.manifestComponents.set(key, new DecodeableMap<string, SourceComponent>());
      }
      this.manifestComponents.get(key)?.set(srcKey, sc);
    }

    if (!(component instanceof SourceComponent)) {
      return;
    }
    const srcKey = sourceKey(component);

    // we're working with SourceComponents now
    this.components.get(key)?.set(srcKey, component);

    // track AiAuthoringBundles separately for fast access (exclude destructive changes - no need to compile something that will be deleted)
    if (component.type.id === 'aiauthoringbundle' && !deletionType) {
      this.aiAuthoringBundles.add(component);
    }

    // Build maps of destructive components and regular components as they are added
    // as an optimization when building manifests.
    if (deletionType) {
      component.setMarkedForDelete(deletionType);
      this.logger.debug(`Marking component for delete: ${component.fullName}`);
      if (!this.destructiveComponents[deletionType].has(key)) {
        this.destructiveComponents[deletionType].set(key, new DecodeableMap<string, SourceComponent>());
      }
      this.destructiveComponents[deletionType].get(key)?.set(srcKey, component);
      // updated with deletion information
      this.components.get(key)?.set(srcKey, component);
    } else {
      if (!this.manifestComponents.has(key)) {
        this.manifestComponents.set(key, new DecodeableMap<string, SourceComponent>());
      }
      this.manifestComponents.get(key)?.set(srcKey, component);
    }
  }

  /**
   * Tests whether or not a `fullName` and `type` pair is present in the set.
   *
   * A pair is considered present in the set if one of the following criteria is met:
   *
   * - The pair is directly in the set, matching the component key "as is" or decoded.
   * - A wildcard component with the same `type` as the pair
   * - If a parent is attached to the pair and the parent is directly in the set
   * - If a parent is attached to the pair, and a wildcard component's `type` matches the parent's `type`
   *
   * @param component Component to test for membership in the set
   * @returns `true` if the component is in the set
   */
  public has(component: ComponentLike): boolean {
    const key = simpleKey(component);
    if (this.components.has(key)) {
      return true;
    }

    const wildcardMember: ComponentLike = {
      fullName: ComponentSet.WILDCARD,
      type: typeof component.type === 'object' ? component.type.name : component.type,
    };
    const isIncludedInWildcard = this.components.has(simpleKey(wildcardMember));
    if (isIncludedInWildcard) {
      return true;
    }

    if (typeof component.type === 'object') {
      const { parent } = component as MetadataComponent;
      if (parent) {
        const parentDirectlyInSet = this.components.has(simpleKey(parent));
        if (parentDirectlyInSet) {
          return true;
        }

        const wildcardKey = simpleKey({
          fullName: ComponentSet.WILDCARD,
          type: parent.type,
        });
        const parentInWildcard = this.components.has(wildcardKey);
        if (parentInWildcard) {
          return true;
        }
        const partialWildcardKey = simpleKey({
          fullName: `${parent.fullName}.${ComponentSet.WILDCARD}`,
          type: component.type,
        });
        const parentInPartialWildcard = this.components.has(partialWildcardKey);
        if (parentInPartialWildcard) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * For a fullName and type, this returns the filenames the matching component, or an empty array if the component is not present
   *
   * @param param Object with fullName and type properties
   * @returns string[]
   */
  public getComponentFilenamesByNameAndType({ fullName, type }: MetadataMember): string[] {
    const key = simpleKey({ fullName, type });
    const componentMap = this.components.get(key);
    if (!componentMap) {
      return [];
    }
    const output = new Set<string>();
    componentMap.forEach((component) => {
      [...component.walkContent(), component.content, component.xml]
        .filter(isString)
        .map((filename) => output.add(filename));
    });
    return Array.from(output);
  }

  public *[Symbol.iterator](): Iterator<MetadataComponent> {
    for (const [key, sourceComponents] of this.components.entries()) {
      if (sourceComponents.size === 0) {
        const [typeName, fullName] = splitOnFirstDelimiter(key);
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
   * Will return the types of destructive changes in the component set
   * or an empty array if there aren't destructive components present
   *
   * @return DestructiveChangesType[]
   */
  public getTypesOfDestructiveChanges(): DestructiveChangesType[] {
    const destructiveChangesTypes: DestructiveChangesType[] = [];
    if (this.destructiveChangesPre.size) {
      destructiveChangesTypes.push(DestructiveChangesType.PRE);
    }
    if (this.destructiveChangesPost.size) {
      destructiveChangesTypes.push(DestructiveChangesType.POST);
    }
    return destructiveChangesTypes;
  }

  /**
   * Returns an API version to use as the value of the `version` field
   * in a manifest (package.xml) for MDAPI calls in the following order
   * of preference:
   *
   * 1. this.sourceApiVersion
   * 2. this.apiVersion
   * 3. sourceApiVersion set in sfdx-project.json
   * 4. apiVersion from ConfigAggregator (config files and Env Vars)
   * 5. http call to apexrest endpoint for highest apiVersion
   * 6. hardcoded value of "58.0" as a last resort
   *
   * @returns string The resolved API version to use in a manifest
   */
  private async getApiVersion(): Promise<string> {
    let version = this.sourceApiVersion ?? this.apiVersion;

    if (!version) {
      try {
        const project = await SfProject.resolve(this.projectDirectory);
        const projectConfig = await project.resolveProjectConfig();
        version = projectConfig?.sourceApiVersion as string;
      } catch (e) {
        // If there's any problem just move on to ConfigAggregator
      }
    }

    if (!version) {
      try {
        version = ConfigAggregator.getValue(OrgConfigProperties.ORG_API_VERSION).value as string;
      } catch (e) {
        // If there's any problem just move on to the REST endpoint
      }
    }

    if (!version) {
      try {
        version = `${await getCurrentApiVersion()}.0`;
      } catch (e) {
        version = '58.0';
        this.logger.warn(messages.getMessage('missingApiVersion'));
      }
    }
    return version;
  }
}

const sourceKey = (component: SourceComponent): string => {
  const { fullName, type, xml, content } = component;
  return `${type.name}${fullName}${xml ?? ''}${content ?? ''}`;
};

export const simpleKey = (component: ComponentLike): SimpleKeyString => {
  const typeName = typeof component.type === 'string' ? component.type.toLowerCase().trim() : component.type.id;
  return `${typeName}${KEY_DELIMITER}${component.fullName}`;
};

const splitOnFirstDelimiter = (input: string): [string, string] => {
  const indexOfSplitChar = input.indexOf(KEY_DELIMITER);
  return [input.substring(0, indexOfSplitChar), input.substring(indexOfSplitChar + 1)];
};

const constructFullName = (registry: RegistryAccess, type: MetadataType, fullName: string): string =>
  // Some InFolder types are different. e.g., Report/ReportFolder & Dashboard/DashboardFolder.
  // ReportFolders are deployed/retrieved as Reports. If a ReportFolder is being added append
  // a "/" so the metadata API can identify it as a folder.
  ['DashboardFolder', 'ReportFolder', 'EmailTemplateFolder'].includes(type.name) && !fullName.endsWith('/')
    ? `${fullName}/`
    : registry.getParentType(type.name)?.strategies?.recomposition === 'startEmpty' && fullName.includes('.')
    ? // they're reassembled like CustomLabels.MyLabel
      fullName.split('.')[1]
    : fullName;

/** side effect: mutates the typeMap property */
const addToTypeMap = ({
  typeMap,
  type,
  fullName,
  destructiveType,
}: {
  typeMap: Map<string, Set<string>>;
  type: MetadataType;
  fullName: string;
  destructiveType?: DestructiveChangesType;
}): void => {
  if (type.isAddressable === false) return;
  if (fullName === ComponentSet.WILDCARD && !type.supportsWildcardAndName && !destructiveType) {
    // if the type doesn't support mixed wildcards and specific names, overwrite the names to be a wildcard
    typeMap.set(type.name, new Set([fullName]));
    return;
  }
  const existing = typeMap.get(type.name) ?? new Set<string>();
  if (!existing.has(ComponentSet.WILDCARD) || type.supportsWildcardAndName) {
    // if the type supports both wildcards and names, add them regardless
    typeMap.set(type.name, existing.add(fullName));
  }
};
