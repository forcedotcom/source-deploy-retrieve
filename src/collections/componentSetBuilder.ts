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

import * as path from 'node:path';
import { AuthInfo, Connection, Logger, Messages, SfError, StateAggregator } from '@salesforce/core';
import fs from 'graceful-fs';
import { minimatch } from 'minimatch';
import { MetadataComponent } from '../resolve/types';
import { SourceComponent } from '../resolve/sourceComponent';
import { ComponentSet } from '../collections/componentSet';
import { RegistryAccess } from '../registry/registryAccess';
import type { FileProperties } from '../client/types';
import { MetadataType } from '../registry/types';
import { MetadataResolver } from '../resolve';
import { resolveAgentMdEntries, parseBotVersionFilter } from '../resolve/pseudoTypes/agentResolver';
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
   * @param options
   */

  // eslint-disable-next-line complexity
  public static async build(options: ComponentSetOptions): Promise<ComponentSet> {
    let componentSet: ComponentSet | undefined;

    const { sourcepath, manifest, metadata, packagenames, org } = options;
    const registry = new RegistryAccess(undefined, options.projectDir);

    if (sourcepath?.length) {
      getLogger().debug(`Building ComponentSet from sourcepath: ${sourcepath.join(', ')}`);
      const fsPaths = sourcepath.map(validateAndResolvePath);
      componentSet = ComponentSet.fromSource({
        fsPaths,
        registry,
      });
      if (metadata?.excludedEntries?.length) {
        const toRemove = metadata.excludedEntries
          .map(entryToTypeAndName(registry))
          .flatMap(typeAndNameToMetadataComponents({ directoryPaths: fsPaths, registry }));
        componentSet = componentSet.filter(
          (md) =>
            !toRemove.some((n) => n.type.name === md.type.name && (n.fullName === md.fullName || n.fullName === '*'))
        );
      }
      if (metadata?.metadataEntries?.length) {
        const toKeep = metadata.metadataEntries
          .map(entryToTypeAndName(registry))
          .flatMap(typeAndNameToMetadataComponents({ directoryPaths: fsPaths, registry }));
        componentSet = componentSet.filter((md) =>
          toKeep.some((n) => n.type.name === md.type.name && (n.fullName === md.fullName || n.fullName === '*'))
        );
      }
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
    if (metadata && !org && !sourcepath?.length) {
      getLogger().debug(`Building ComponentSet from metadata: ${metadata.metadataEntries.toString()}`);
      const directoryPaths = metadata.directoryPaths;
      componentSet ??= new ComponentSet(undefined, registry);
      const componentSetFilter = new ComponentSet(undefined, registry);

      // If pseudo types were passed without an org option replace the pseudo types with
      // "client side spidering"
      const { replacedEntries, botVersionFilters } = await replacePseudoTypes({ mdOption: metadata, registry });
      // Ensure all entries are valid strings
      metadata.metadataEntries = replacedEntries.filter(
        (entry): entry is string => typeof entry === 'string' && entry.length > 0
      );
      if (botVersionFilters.length > 0) {
        componentSet.botVersionFilters = botVersionFilters;
      }

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
      const { componentSet: orgComponentSet, botVersionFilters: orgBotVersionFilters } =
        await this.resolveOrgComponents(registry, options);
      orgComponentSet.toArray().map(addToComponentSet(componentSet));
      if (orgBotVersionFilters.length > 0) {
        componentSet.botVersionFilters = orgBotVersionFilters;
      }
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
  ): Promise<{
    componentSet: ComponentSet;
    botVersionFilters: Array<{ botName: string; versionFilter: 'all' | 'highest' | number }>;
  }> {
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
    const botVersionFilters: Array<{ botName: string; versionFilter: 'all' | 'highest' | number }> = [];
    if (metadata) {
      if (metadata.metadataEntries?.length) {
        debugMsg += ` filtering on metadata: ${metadata.metadataEntries.toString()}`;
        // Replace pseudo-types from the metadataEntries
        const { replacedEntries, botVersionFilters: orgBotVersionFilters } = await replacePseudoTypes({
          mdOption: metadata,
          connection,
          registry,
        });
        // Ensure all entries are valid strings in Type:Name format
        metadata.metadataEntries = replacedEntries.filter(
          (entry): entry is string => typeof entry === 'string' && entry.length > 0 && entry.includes(':')
        );
        if (orgBotVersionFilters.length > 0) {
          botVersionFilters.push(...orgBotVersionFilters);
        }
      }
      if (metadata.excludedEntries?.length) {
        debugMsg += ` excluding metadata: ${metadata.excludedEntries.toString()}`;
      }
      mdMap = buildMapFromMetadata(metadata, registry);
    }
    getLogger().debug(debugMsg);

    const componentSet = await ComponentSet.fromConnection({
      usernameOrConnection: connection,
      componentFilter: getOrgComponentFilter(org, mdMap, metadata, registry),
      metadataTypes: mdMap.size ? Array.from(mdMap.keys()) : undefined,
      registry,
    });

    return { componentSet, botVersionFilters };
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
  metadata?: MetadataOption,
  registry?: RegistryAccess
): FromConnectionOptions['componentFilter'] =>
  metadata?.metadataEntries?.length
    ? (component: Partial<FileProperties>): boolean => {
        if (component.type && component.fullName) {
          // Normalize the type name using the registry to match mdMap keys
          let normalizedTypeName = component.type;
          if (registry) {
            try {
              normalizedTypeName = registry.getTypeByName(component.type).name;
            } catch {
              // If type not found in registry, use original type name
              normalizedTypeName = component.type;
            }
          }
          const mdMapEntry = mdMap.get(normalizedTypeName);
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
      if (cmp.type.folderType) {
        excludedTypes.push(registry.getTypeByName(cmp.type.folderType).name);
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
const replacePseudoTypes = async (pseudoTypeInfo: {
  mdOption: MetadataOption;
  connection?: Connection;
  registry: RegistryAccess;
}): Promise<{
  replacedEntries: string[];
  botVersionFilters: Array<{ botName: string; versionFilter: 'all' | 'highest' | number }>;
}> => {
  const { mdOption, connection, registry } = pseudoTypeInfo;
  const pseudoEntries: string[][] = [];
  let replacedEntries: string[] = [];
  const botVersionFilters: Array<{ botName: string; versionFilter: 'all' | 'highest' | number }> = [];

  mdOption.metadataEntries.map((rawEntry) => {
    const [typeName, ...name] = rawEntry.split(':');
    if (Object.values(PSEUDO_TYPES).includes(typeName)) {
      pseudoEntries.push([typeName, name.join(':').trim()]);
    } else if (typeName === 'Bot') {
      // Handle Bot entries with version suffixes (e.g., Bot:myBot_1, Bot:myBot_*)
      const botName = name.join(':').trim();
      const { baseBotName, versionFilter } = parseBotVersionFilter(botName);
      botVersionFilters.push({ botName: baseBotName, versionFilter });
      // Remove version suffix from metadata name
      replacedEntries.push(`${typeName}:${baseBotName}`);
    } else {
      // Normalize entries without colons to Type:* format
      // This allows entries like "PermissionSet" or "Flow" to be treated as "PermissionSet:*" or "Flow:*"
      const normalizedEntry = name.length > 0 ? rawEntry : `${rawEntry}:*`;
      replacedEntries.push(normalizedEntry);
    }
  });

  if (pseudoEntries.length) {
    await Promise.all(
      pseudoEntries.map(async (pseudoEntry) => {
        const pseudoType = pseudoEntry[0];
        const pseudoName = pseudoEntry[1] || '*';
        getLogger().debug(`Converting pseudo-type ${pseudoType}:${pseudoName}`);
        if (pseudoType === PSEUDO_TYPES.AGENT) {
          // Parse version filter from botName
          const { baseBotName, versionFilter } = parseBotVersionFilter(pseudoName);
          botVersionFilters.push({ botName: baseBotName, versionFilter });
          const agentMdEntries = await resolveAgentMdEntries({
            botName: baseBotName,
            connection,
            directoryPaths: mdOption.directoryPaths,
            registry,
          });
          // Convert entries to Type:Name format
          // If entry is just a type name (no colon), treat it as Type:*
          const validEntries = agentMdEntries
            .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
            .map((entry) => (entry.includes(':') ? entry : `${entry}:*`));
          replacedEntries = [...replacedEntries, ...validEntries];
        }
      })
    );
  }

  return { replacedEntries, botVersionFilters };
};
