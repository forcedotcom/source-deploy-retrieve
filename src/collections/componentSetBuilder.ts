/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import { AuthInfo, Connection, Logger, Messages, SfError, StateAggregator, trimTo15 } from '@salesforce/core';
import fs from 'graceful-fs';
import { minimatch } from 'minimatch';
import { MetadataComponent } from '../resolve/types';
import { SourceComponent } from '../resolve/sourceComponent';
import { ComponentSet } from '../collections/componentSet';
import { RegistryAccess } from '../registry/registryAccess';
import type { FileProperties } from '../client/types';
import { MetadataType } from '../registry/types';
import { MetadataResolver } from '../resolve';
import { DestructiveChangesType, FromConnectionOptions } from './types';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

export type ManifestOption = {
  manifestPath: string;
  directoryPaths: string[];
  destructiveChangesPre?: string;
  destructiveChangesPost?: string;
};

type MetadataOption = {
  /**
   * Array of metadata type:name pairs to include in the ComponentSet.
   */
  metadataEntries: string[];
  /**
   * Array of filesystem directory paths to search for local metadata to include in the ComponentSet.
   */
  directoryPaths: string[];
  /**
   * Array of metadata type:name pairs to exclude from the ComponentSet.
   */
  excludedEntries?: string[];
  /**
   * Array of metadata type:name pairs to delete before the deploy. Use of wildcards is not allowed.
   */
  destructiveEntriesPre?: string[];
  /**
   * Array of metadata type:name pairs to delete after the deploy. Use of wildcards is not allowed.
   */
  destructiveEntriesPost?: string[];
};

type OrgOption = {
  username: string;
  exclude: string[];
};

export type ComponentSetOptions = {
  packagenames?: string[];
  sourcepath?: string[];
  manifest?: ManifestOption;
  metadata?: MetadataOption;
  apiversion?: string;
  sourceapiversion?: string;
  org?: OrgOption;
  /** important for constructing registries based on your project.  Uses CWD by default */
  projectDir?: string;
};

type MetadataMap = Map<string, string[]>;

let logger: Logger;
const getLogger = (): Logger => {
  if (!logger) {
    logger = Logger.childFromRoot('ComponentSetBuilder');
  }
  return logger;
};

const PSEUDO_TYPES = { AGENT: 'Agent' };

export class ComponentSetBuilder {
  /**
   * Builds a ComponentSet that can be used for source conversion,
   * deployment, or retrieval, using all specified options.
   *
   * @see https://github.com/forcedotcom/source-deploy-retrieve/blob/develop/src/collections/componentSet.ts
   *
   * @param options: options for creating a ComponentSet
   */

  public static async build(options: ComponentSetOptions): Promise<ComponentSet> {
    let componentSet: ComponentSet | undefined;

    const { sourcepath, manifest, metadata, packagenames, org } = options;
    const registry = new RegistryAccess(undefined, options.projectDir);

    if (sourcepath) {
      getLogger().debug(`Building ComponentSet from sourcepath: ${sourcepath.join(', ')}`);
      const fsPaths = sourcepath.map(validateAndResolvePath);
      componentSet = ComponentSet.fromSource({
        fsPaths,
        registry,
      });
    }

    // Return empty ComponentSet and use packageNames in the connection via `.retrieve` options
    if (packagenames) {
      getLogger().debug(`Building ComponentSet for packagenames: ${packagenames.toString()}`);
      componentSet ??= new ComponentSet(undefined, registry);
    }

    // Resolve manifest with source in package directories.
    if (manifest) {
      getLogger().debug(`Building ComponentSet from manifest: ${manifest.manifestPath}`);
      assertFileExists(manifest.manifestPath);

      getLogger().debug(`Searching in packageDir: ${manifest.directoryPaths.join(', ')} for matching metadata`);
      componentSet = await ComponentSet.fromManifest({
        manifestPath: manifest.manifestPath,
        resolveSourcePaths: manifest.directoryPaths,
        forceAddWildcards: true,
        destructivePre: manifest.destructiveChangesPre,
        destructivePost: manifest.destructiveChangesPost,
        registry,
      });
    }

    // Resolve metadata entries with source in package directories, unless we are building a ComponentSet
    // from metadata in an org.
    if (metadata && !org) {
      getLogger().debug(`Building ComponentSet from metadata: ${metadata.metadataEntries.toString()}`);
      const directoryPaths = metadata.directoryPaths;
      componentSet ??= new ComponentSet(undefined, registry);
      const componentSetFilter = new ComponentSet(undefined, registry);

      // Build a Set of metadata entries
      metadata.metadataEntries
        .map(entryToTypeAndName(registry))
        .flatMap(typeAndNameToMetadataComponents({ directoryPaths, registry }))
        .map(addToComponentSet(componentSet))
        .map(addToComponentSet(componentSetFilter));

      getLogger().debug(`Searching for matching metadata in directories: ${directoryPaths.join(', ')}`);

      // add destructive changes if defined. Because these are deletes, all entries
      // are resolved to SourceComponents
      if (metadata.destructiveEntriesPre) {
        metadata.destructiveEntriesPre
          .map(entryToTypeAndName(registry))
          .map(assertNoWildcardInDestructiveEntries)
          .flatMap(typeAndNameToMetadataComponents({ directoryPaths, registry }))
          .map((mdComponent) => new SourceComponent({ type: mdComponent.type, name: mdComponent.fullName }))
          .map(addToComponentSet(componentSet, DestructiveChangesType.PRE));
      }
      if (metadata.destructiveEntriesPost) {
        metadata.destructiveEntriesPost
          .map(entryToTypeAndName(registry))
          .map(assertNoWildcardInDestructiveEntries)
          .flatMap(typeAndNameToMetadataComponents({ directoryPaths, registry }))
          .map((mdComponent) => new SourceComponent({ type: mdComponent.type, name: mdComponent.fullName }))
          .map(addToComponentSet(componentSet, DestructiveChangesType.POST));
      }

      const resolvedComponents = ComponentSet.fromSource({
        fsPaths: directoryPaths,
        include: componentSetFilter,
        registry,
      });

      if (resolvedComponents.forceIgnoredPaths) {
        // if useFsForceIgnore = true, then we won't be able to resolve a forceignored path,
        // which we need to do to get the ignored source component
        const resolver = new MetadataResolver(registry, undefined, false);

        for (const ignoredPath of resolvedComponents.forceIgnoredPaths ?? []) {
          resolver.getComponentsFromPath(ignoredPath).map((ignored) => {
            componentSet = componentSet?.filter(
              (resolved) => !(resolved.fullName === ignored.name && resolved.type === ignored.type)
            );
          });
        }
        componentSet.forceIgnoredPaths = resolvedComponents.forceIgnoredPaths;
      }

      resolvedComponents.toArray().map(addToComponentSet(componentSet));
    }

    // Resolve metadata entries with an org connection
    if (org) {
      componentSet ??= new ComponentSet(undefined, registry);
      const orgComponentSet = await this.resolveOrgComponents(registry, options);
      orgComponentSet.toArray().map(addToComponentSet(componentSet));
    }

    // there should have been a componentSet created by this point.
    componentSet = assertComponentSetIsNotUndefined(componentSet);
    componentSet.apiVersion ??= options.apiversion;
    componentSet.sourceApiVersion ??= options.sourceapiversion;
    componentSet.projectDirectory = options.projectDir;

    logComponents(componentSet);
    return componentSet;
  }

  private static async resolveOrgComponents(
    registry: RegistryAccess,
    options: ComponentSetOptions
  ): Promise<ComponentSet> {
    // Get a connection from the OrgOption
    const { apiversion, org, metadata } = options;
    if (!org) {
      throw SfError.create({ message: 'ComponentSetBuilder.resolveOrgComponents() requires an OrgOption' });
    }
    const username = (await StateAggregator.getInstance()).aliases.getUsername(org.username) ?? org.username;
    const connection = await Connection.create({ authInfo: await AuthInfo.create({ username }) });
    if (apiversion) {
      connection.setApiVersion(apiversion);
    }

    let mdMap = new Map() as MetadataMap;
    let debugMsg = `Building ComponentSet from metadata in an org using targetUsername: ${username}`;
    if (metadata) {
      if (metadata.metadataEntries?.length) {
        debugMsg += ` filtering on metadata: ${metadata.metadataEntries.toString()}`;
        // Replace pseudo-types from the metadataEntries
        metadata.metadataEntries = await replacePseudoTypes(metadata.metadataEntries, connection);
      }
      if (metadata.excludedEntries?.length) {
        debugMsg += ` excluding metadata: ${metadata.excludedEntries.toString()}`;
      }
      mdMap = buildMapFromMetadata(metadata, registry);
    }
    getLogger().debug(debugMsg);

    return ComponentSet.fromConnection({
      usernameOrConnection: connection,
      componentFilter: getOrgComponentFilter(org, mdMap, metadata),
      metadataTypes: mdMap.size ? Array.from(mdMap.keys()) : undefined,
      registry,
    });
  }
}

const addToComponentSet =
  (cs: ComponentSet, deletionType?: DestructiveChangesType) =>
  (cmp: MetadataComponent): MetadataComponent => {
    cs.add(cmp, deletionType);
    return cmp;
  };

const validateAndResolvePath = (filepath: string): string => path.resolve(assertFileExists(filepath));

const assertFileExists = (filepath: string): string => {
  if (!fs.existsSync(filepath)) {
    throw new SfError(messages.getMessage('error_path_not_found', [filepath]));
  }
  return filepath;
};

const assertComponentSetIsNotUndefined = (componentSet: ComponentSet | undefined): ComponentSet => {
  if (componentSet === undefined) {
    throw new SfError('undefinedComponentSet');
  }
  return componentSet;
};

const assertNoWildcardInDestructiveEntries = (mdEntry: MetadataTypeAndMetadataName): MetadataTypeAndMetadataName => {
  if (mdEntry.metadataName.includes('*')) {
    throw SfError.create({ message: 'Wildcards are not supported when providing destructive metadata entries' });
  }
  return mdEntry;
};

/** This is only for debug output of matched files based on the command flags.
 * It will log up to 20 file matches. */
const logComponents = (componentSet: ComponentSet): void => {
  getLogger().debug(`Matching metadata files (${componentSet.size}):`);

  const components = componentSet.getSourceComponents().toArray();

  components
    .slice(0, 20)
    .map((cmp) => cmp.content ?? cmp.xml ?? cmp.fullName)
    .map((m) => getLogger().debug(m));
  if (components.length > 20) getLogger().debug(`(showing 20 of ${componentSet.size} matches)`);

  getLogger().debug(`ComponentSet apiVersion = ${componentSet.apiVersion ?? '<not set>'}`);
  getLogger().debug(`ComponentSet sourceApiVersion = ${componentSet.sourceApiVersion ?? '<not set>'}`);
};

const getOrgComponentFilter = (
  org: OrgOption,
  mdMap: MetadataMap,
  metadata?: MetadataOption
): FromConnectionOptions['componentFilter'] =>
  metadata?.metadataEntries?.length
    ? (component: Partial<FileProperties>): boolean => {
        if (component.type && component.fullName) {
          const mdMapEntry = mdMap.get(component.type);
          // using minimatch versus RegExp provides better (more expected) matching results
          return (
            !!mdMapEntry &&
            mdMapEntry.some((mdName) => typeof component.fullName === 'string' && minimatch(component.fullName, mdName))
          );
        }
        return false;
      }
    : // *** Default Filter ***
      // exclude components based on the results of componentFilter function
      // components with namespacePrefix where org.exclude includes manageableState (to exclude managed packages)
      // components with namespacePrefix where manageableState equals undefined (to exclude components e.g. InstalledPackage)
      // components where org.exclude includes manageableState (to exclude packages without namespacePrefix e.g. unlocked packages)

      (component: Partial<FileProperties>): boolean =>
        !component?.manageableState || !org.exclude?.includes(component.manageableState);

type MetadataTypeAndMetadataName = { type: MetadataType; metadataName: string };

// The registry will throw if it doesn't know what this type is.
export const entryToTypeAndName =
  (reg: RegistryAccess) =>
  (rawEntry: string): MetadataTypeAndMetadataName => {
    // split on the first colon, and then join the rest back together to support names that include colons
    const [typeName, ...name] = rawEntry.split(':');
    const type = reg.getTypeByName(typeName.trim());
    if (type.name === 'CustomLabels' && type.strategies?.transformer === 'decomposedLabels') {
      throw new Error('Use CustomLabel instead of CustomLabels for decomposed labels');
    }
    return { type, metadataName: name.length ? name.join(':').trim() : '*' };
  };

const typeAndNameToMetadataComponents =
  (context: { directoryPaths: ManifestOption['directoryPaths']; registry: RegistryAccess }) =>
  ({ type, metadataName }: MetadataTypeAndMetadataName): MetadataComponent[] =>
    // this '.*' is a surprisingly valid way to specify a metadata, especially a DEB :sigh:
    // https://github.com/salesforcecli/plugin-deploy-retrieve/blob/main/test/nuts/digitalExperienceBundle/constants.ts#L140
    // because we're filtering from what we have locally, this won't allow you to retrieve new metadata (on the server only) using the partial wildcard
    // to do that, you'd need check the size of the CS created below, see if it's 0, and then query the org for the metadata that matches the regex
    // but building a CS from a metadata argument doesn't require an org, so we can't do that here

    metadataName?.includes('*') && metadataName.length > 1 && !metadataName.includes('.*')
      ? // get all components of the type, and then filter by the regex of the fullName
        ComponentSet.fromSource({
          fsPaths: context.directoryPaths,
          include: new ComponentSet([{ type, fullName: ComponentSet.WILDCARD }], context.registry),
          registry: context.registry,
        })
          .getSourceComponents()
          .toArray()
          // using minimatch versus RegExp provides better (more expected) matching results
          .filter((cs) => minimatch(cs.fullName, metadataName))
      : [{ type, fullName: metadataName }];

const buildMapFromMetadata = (mdOption: MetadataOption, registry: RegistryAccess): MetadataMap => {
  const mdMap: MetadataMap = new Map<string, string[]>();

  // Add metadata type entries we were told to include
  if (mdOption.metadataEntries?.length) {
    mdOption.metadataEntries.map(entryToTypeAndName(registry)).map((cmp) => {
      mdMap.set(cmp.type.name, [...(mdMap.get(cmp.type.name) ?? []), cmp.metadataName]);
    });
  }

  // Build an array of excluded types from the options
  if (mdOption.excludedEntries?.length) {
    const excludedTypes: string[] = [];
    mdOption.excludedEntries.map(entryToTypeAndName(registry)).map((cmp) => {
      if (cmp.metadataName === '*') {
        excludedTypes.push(cmp.type.name);
      }
    });
    if (mdMap.size === 0) {
      // we are excluding specific metadata types from all supported types
      Object.values(registry.getRegistry().types).map((t) => {
        if (!excludedTypes.includes(t.name)) {
          mdMap.set(t.name, []);
        }
      });
    }
  }

  return mdMap;
};

// Replace pseudo types with actual types.
const replacePseudoTypes = async (mdEntries: string[], connection: Connection): Promise<string[]> => {
  const pseudoEntries: string[][] = [];
  let replacedEntries: string[] = [];

  mdEntries.map((rawEntry) => {
    const [typeName, ...name] = rawEntry.split(':');
    if (Object.values(PSEUDO_TYPES).includes(typeName)) {
      pseudoEntries.push([typeName, name.join(':').trim()]);
    } else {
      replacedEntries.push(rawEntry);
    }
  });

  if (pseudoEntries.length) {
    await Promise.all(
      pseudoEntries.map(async (pseudoEntry) => {
        const pseudoType = pseudoEntry[0];
        const pseudoName = pseudoEntry[1] || '*';
        getLogger().debug(`Converting pseudo-type ${pseudoType}:${pseudoName}`);
        if (pseudoType === PSEUDO_TYPES.AGENT) {
          const agentMdEntries = await buildAgentMdEntries(pseudoName, connection);
          replacedEntries = [...replacedEntries, ...agentMdEntries];
        }
      })
    );
  }

  return replacedEntries;
};

// From a Bot developer name, get all related BotVersion, GenAiPlanner, and GenAiPlugin metadata.
const buildAgentMdEntries = async (botName: string, connection: Connection): Promise<string[]> => {
  if (botName === '*') {
    // Get all Agent top level metadata
    return Promise.resolve(['Bot', 'BotVersion', 'GenAiPlanner', 'GenAiPlugin']);
  }

  const mdEntries = [`Bot:${botName}`, `BotVersion:${botName}.v1`, `GenAiPlanner:${botName}`];

  try {
    // Query for the GenAiPlannerId
    const genAiPlannerIdQuery = `SELECT Id FROM GenAiPlannerDefinition WHERE DeveloperName = '${botName}'`;
    const plannerId = (await connection.singleRecordQuery<{ Id: string }>(genAiPlannerIdQuery, { tooling: true })).Id;

    if (plannerId) {
      const plannerId15 = trimTo15(plannerId);
      // Query for the GenAiPlugins associated with the 15 char GenAiPlannerId
      const genAiPluginNames = (
        await connection.tooling.query<{ DeveloperName: string }>(
          `SELECT DeveloperName FROM GenAiPluginDefinition WHERE DeveloperName LIKE 'p_${plannerId15}%'`
        )
      ).records;
      if (genAiPluginNames.length) {
        genAiPluginNames.map((r) => mdEntries.push(`GenAiPlugin:${r.DeveloperName}`));
      } else {
        getLogger().debug(`No GenAiPlugin metadata matches for plannerId: ${plannerId15}`);
      }
    } else {
      getLogger().debug(`No GenAiPlanner metadata matches for Bot: ${botName}`);
    }
  } catch (err) {
    const wrappedErr = SfError.wrap(err);
    getLogger().debug(`Error when querying for GenAiPlugin by Bot name: ${botName}\n${wrappedErr.message}`);
    if (wrappedErr.stack) {
      getLogger().debug(wrappedErr.stack);
    }
  }

  // Get specific Agent top level metadata.
  return Promise.resolve(mdEntries);
};
