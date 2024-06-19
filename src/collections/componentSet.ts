/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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
type ComponentMapMap = DecodeableMap<string, DecodeableMap<string, SourceComponent>>;

const KEY_DELIMITER = '#-#';
const NOT_DESTRUCTIVE = 'SDR_NOT_DESTRUCTIVE';

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
  public readonly registry: RegistryAccess;
  /** package name */
  public fullName?: string;
  /** when the component set is created, any paths to things that *would* have become components are added here */
  public forceIgnoredPaths?: Set<string>;

  private logger: Logger;
  private components: ComponentMapMap = new DecodeableMap<string, DecodeableMap<string, SourceComponent>>();

  /** @deprecated mark individual components for deletion type, not the whole CS.  Has no effect */
  private destructiveChangesType = DestructiveChangesType.POST;

  public constructor(components: Iterable<ComponentLike> = [], registry = new RegistryAccess()) {
    super();
    this.registry = registry;
    this.logger = Logger.childFromRoot(this.constructor.name);

    for (const component of components) {
      const destructiveType = component instanceof SourceComponent ? component.getDestructiveChangesType() : undefined;

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
    return filterComponentsByDestructiveKey(DestructiveChangesType.PRE)(this.components);
  }

  public get destructiveChangesPost(): DecodeableMap<string, DecodeableMap<string, SourceComponent>> {
    return filterComponentsByDestructiveKey(DestructiveChangesType.POST)(this.components);
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
    const { fsPaths, registry, tree, include, fsDeletePaths = [] } = parseFromSourceInputs(input);
    const resolver = new MetadataResolver(registry, tree);
    const cs = new ComponentSet([], registry);
    const buildComponents = (paths: string[], destructiveType?: DestructiveChangesType): void => {
      for (const path of paths) {
        for (const component of resolver.getComponentsFromPath(path, include)) {
          cs.add(component, destructiveType);
        }
      }
    };
    buildComponents(fsPaths);
    buildComponents(fsDeletePaths, DestructiveChangesType.POST);

    cs.forceIgnoredPaths = resolver.forceIgnoredPaths;

    return cs;
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

    const resolvedSets = options.resolveSourcePaths
      ? {
          include: new ComponentSet([], options.registry),
          pre: new ComponentSet([], options.registry),
          post: new ComponentSet([], options.registry),
        }
      : undefined;

    const result = new ComponentSet([], options.registry);

    result.logger.debug(`Setting sourceApiVersion of ${manifest.apiVersion} on ComponentSet from manifest`);
    result.sourceApiVersion = manifest.apiVersion;
    result.fullName = manifest.fullName;

    if (options.destructivePre) {
      (await manifestResolver.resolve(options.destructivePre)).components.map((c) =>
        resolvedSets ? add(resolvedSets.pre)()(c) : result.add(c, DestructiveChangesType.PRE)
      );
    }

    if (options.destructivePost) {
      (await manifestResolver.resolve(options.destructivePost)).components.map((c) =>
        resolvedSets ? add(resolvedSets.post)()(c) : result.add(c, DestructiveChangesType.POST)
      );
    }
    manifest.components.map((c) => {
      resolvedSets?.include.add(c);
      if (options.resolveSourcePaths === undefined || options.forceAddWildcards === true || isNotWildcard(c)) {
        result.add(c);
      }
    });

    if (options.resolveSourcePaths && resolvedSets) {
      const components = ComponentSet.fromSource({
        fsPaths: options.resolveSourcePaths,
        tree: options.tree,
        include: resolvedSets.include,
        registry: options.registry,
      });

      result.forceIgnoredPaths = components.forceIgnoredPaths;
      components.getSourceComponents().toArray().map(add(result)());

      // if there was nothing in the resolveIncludeSet, then we can be missing information that we display to the user for deletes
      if (resolvedSets.include.size === 0 && resolvedSets.pre) {
        const preCS = ComponentSet.fromSource({
          fsPaths: options.resolveSourcePaths,
          tree: options.tree,
          include: resolvedSets.pre,
          registry: options.registry,
        });
        preCS.getSourceComponents().toArray().map(add(result)(DestructiveChangesType.PRE));
      }

      if (resolvedSets.include?.size === 0 && resolvedSets.post) {
        const postCS = ComponentSet.fromSource({
          fsPaths: options.resolveSourcePaths,
          tree: options.tree,
          include: resolvedSets.post,
          registry: options.registry,
        });
        postCS.getSourceComponents().toArray().map(add(result)(DestructiveChangesType.POST));
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
    });

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
    const version = await this.getApiVersion();
    // If this ComponentSet has components marked for delete, we need to
    // only include those components in a destructiveChanges.xml and
    // all other components in the regular manifest.
    const components = destructiveType
      ? filterComponentsByDestructiveKey(destructiveType)(this.components)
      : filterComponentsByDestructiveKey(NOT_DESTRUCTIVE)(this.components);

    const typeMap = new Map<string, string[]>();

    const addToTypeMap = (type: MetadataType, fullName: string): void => {
      if (type.isAddressable !== false) {
        const typeName = type.name;
        if (!typeMap.has(typeName)) {
          typeMap.set(typeName, []);
        }
        const typeEntry = typeMap.get(typeName);
        if (fullName === ComponentSet.WILDCARD && !type.supportsWildcardAndName && !destructiveType) {
          // if the type doesn't support mixed wildcards and specific names, overwrite the names to be a wildcard
          typeMap.set(typeName, [fullName]);
        } else if (
          typeEntry &&
          !typeEntry.includes(fullName) &&
          (!typeEntry.includes(ComponentSet.WILDCARD) || type.supportsWildcardAndName)
        ) {
          // if the type supports both wildcards and names, add them regardless
          typeMap.get(typeName)?.push(fullName);
        }
      }
    };

    for (const key of components.keys()) {
      const { typeName, fullName } = splitOnFirstDelimiter(key);
      let type = this.registry.getTypeByName(typeName);

      if (type.folderContentType) {
        type = this.registry.getTypeByName(type.folderContentType);
      }
      addToTypeMap(
        type,
        // they're reassembled like CustomLabels.MyLabel
        this.registry.getParentType(type.name)?.strategies?.recomposition === 'startEmpty' && fullName.includes('.')
          ? fullName.split('.')[1]
          : fullName
      );

      // Add children
      const componentMap = components.get(key);
      if (componentMap) {
        for (const comp of componentMap.values()) {
          for (const child of comp.getChildren()) {
            addToTypeMap(child.type, child.fullName);
          }
        }
      }
    }

    const typeMembers = Array.from(typeMap.entries())
      .map(([typeName, members]) => ({ members: members.sort(), name: typeName }))
      .sort((a, b) => (a.name > b.name ? 1 : -1));

    return {
      Package: {
        ...{
          types: typeMembers,
          version,
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
    return new LazyCollection(
      member ? (this.components.get(simpleKey(NOT_DESTRUCTIVE)(member)) ?? []).values() : this
      // ts assertion because 'this' could also be MetadataComponent and filter can't take into account the type guard
    ).filter(isSourceComponent) as LazyCollection<SourceComponent>;
  }

  /**
   * side effect: if you pass in a SourceComponent and a deletion type,
   * this will call SourceComponent.setMarkedForDelete and mutate your SourceComponent
   * */
  public add(component: ComponentLike, deletionType?: DestructiveChangesType): void {
    const key = simpleKey(
      deletionType ??
        // read the deletion type from the SourceComponent if there is one
        (component instanceof SourceComponent ? component.getDestructiveChangesType() : undefined) ??
        NOT_DESTRUCTIVE
    )(component);
    if (!this.components.has(key)) {
      this.components.set(key, new DecodeableMap<string, SourceComponent>());
    }

    if (!(component instanceof SourceComponent)) {
      return;
    }
    // we're working with SourceComponents now
    if (deletionType) {
      component.setMarkedForDelete(deletionType);
    }
    const srcKey = sourceKey(component);
    // assert because it was set above if it didn't exist
    this.components.get(key)!.set(srcKey, component);
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

  public has(component: ComponentLike, destructiveType?: DestructiveChangesType | typeof NOT_DESTRUCTIVE): boolean {
    const waysToMatch = [
      component, // the exact component
      {
        fullName: ComponentSet.WILDCARD, // wildcard matches for the component
        type: typeof component.type === 'object' ? component.type.name : component.type,
      } satisfies ComponentLike,
      // when there's a parent, we want to also match the parent and the parent's wildcards
      ...(typeof component.type === 'object' && 'parent' in component && component.parent
        ? [
            component.parent,
            {
              fullName: ComponentSet.WILDCARD,
              type: component.parent.type,
            } satisfies ComponentLike,
            {
              fullName: `${component.parent.fullName}.${ComponentSet.WILDCARD}`,
              type: component.type,
            } satisfies ComponentLike,
          ]
        : []),
    ];

    return destructiveType
      ? // match the full key including destructive type
        waysToMatch.map(simpleKey(destructiveType)).some((key) => this.components.has(key))
      : // if no destructive type is passed in, we want to match any destructive type
        waysToMatch.some(someComponentMatchesAnyDestructiveType(this.components));
  }

  /**
   * For a fullName and type, this returns the filenames the matching component, or an empty array if the component is not present
   *
   * @param param Object with fullName and type properties
   * @returns string[]
   */
  public getComponentFilenamesByNameAndType({ fullName, type }: MetadataMember): string[] {
    const key = simpleKey(NOT_DESTRUCTIVE)({ fullName, type });
    const componentMap = this.components.get(key) ?? new DecodeableMap<string, SourceComponent>();
    return Array.from(
      new Set(
        Array.from(componentMap.values()).flatMap((component) => [
          ...component.walkContent(),
          component.content,
          component.xml,
        ])
      )
    ).filter(isString);
  }

  public *[Symbol.iterator](): Iterator<MetadataComponent> {
    for (const [key, sourceComponents] of this.components.entries()) {
      if (sourceComponents.size === 0) {
        const { typeName, fullName } = splitOnFirstDelimiter(key);
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
   *
   * @deprecated Use `setMarkedForDelete` on individual components instead of using the CS-level prop
   *
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
   *
   * @deprecated Use `setMarkedForDelete` on individual components instead of using the CS-level prop
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
    return [
      ...(this.destructiveChangesPre.size ? [DestructiveChangesType.PRE] : []),
      ...(this.destructiveChangesPost.size ? [DestructiveChangesType.POST] : []),
    ];
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

/** optionally pass in a destructiveChangesType to limit */
const simpleKey =
  (destructiveChangesType: DestructiveChangesType | typeof NOT_DESTRUCTIVE) =>
  (component: ComponentLike): string => {
    const typeName = typeof component.type === 'string' ? component.type.toLowerCase().trim() : component.type.id;
    return `${typeName}${KEY_DELIMITER}${component.fullName}${KEY_DELIMITER}${destructiveChangesType}`;
  };

/** also removes the destructive type from the end */
const splitOnFirstDelimiter = (input: string): { typeName: string; fullName: string } => {
  const [head, ...tail] = input.split(KEY_DELIMITER);
  return { typeName: head, fullName: tail.filter(isNotDestructiveKey).join(KEY_DELIMITER) };
};

const isNotDestructiveKey = (input: string): boolean =>
  input !== DestructiveChangesType.PRE.toString() &&
  input !== DestructiveChangesType.POST.toString() &&
  input !== NOT_DESTRUCTIVE;

const parseFromSourceInputs = (given: string | string[] | FromSourceOptions): FromSourceOptions => {
  if (Array.isArray(given)) {
    return { fsPaths: given };
  } else if (typeof given === 'object') {
    return given.include ? { ...given, include: removeMarkedForDelete(given.include) } : given;
  } else {
    return { fsPaths: [given] };
  }
};

/** remove components that are marked for delete */
const removeMarkedForDelete = (include: ComponentSet): ComponentSet => {
  const filtered = new ComponentSet([], include.registry);
  for (const component of include) {
    if (!(component instanceof SourceComponent && component.isMarkedForDelete())) {
      filtered.add(component);
    }
  }
  return filtered;
};

const filterComponentsByDestructiveKey =
  (destructiveType: DestructiveChangesType | typeof NOT_DESTRUCTIVE) =>
  (components: ComponentMapMap): ComponentMapMap =>
    new DecodeableMap(
      [...components.entries()].filter(([k]) =>
        k.endsWith(`${KEY_DELIMITER}${destructiveType ? destructiveType : NOT_DESTRUCTIVE}`)
      )
    );

/**
 * preserves the original CS.has() behavior which would match regardless of destructive type
 * would like to remove this in the next major version and only match via has on Constructive components
 */
const someComponentMatchesAnyDestructiveType =
  (components: ComponentMapMap) =>
  (component: ComponentLike): boolean => {
    const allDestructiveTypes = [DestructiveChangesType.PRE, DestructiveChangesType.POST, NOT_DESTRUCTIVE] as const;
    return allDestructiveTypes.map((k) => simpleKey(k)(component)).some((k) => components.has(k));
  };

const isSourceComponent = (component: ComponentLike): component is SourceComponent =>
  component instanceof SourceComponent;

const add =
  (cs: ComponentSet) =>
  (destructiveType?: DestructiveChangesType) =>
  (component: ComponentLike): void =>
    cs.add(component, destructiveType);

const isNotWildcard = (c: MetadataComponent): boolean => c.fullName !== ComponentSet.WILDCARD;
