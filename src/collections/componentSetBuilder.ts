/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import { Logger, Messages, SfError, StateAggregator } from '@salesforce/core';
import fs from 'graceful-fs';
import minimatch from 'minimatch';
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
  metadataEntries: string[];
  directoryPaths: string[];
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

export class ComponentSetBuilder {
  /**
   * Builds a ComponentSet that can be used for source conversion,
   * deployment, or retrieval, using all specified options.
   *
   * @see https://github.com/forcedotcom/source-deploy-retrieve/blob/develop/src/collections/componentSet.ts
   *
   * @param options: options for creating a ComponentSet
   */

  // eslint-disable-next-line complexity
  public static async build(options: ComponentSetOptions): Promise<ComponentSet> {
    const logger = Logger.childFromRoot('componentSetBuilder');
    let componentSet: ComponentSet | undefined;

    const { sourcepath, manifest, metadata, packagenames, apiversion, sourceapiversion, org, projectDir } = options;
    const registryAccess = new RegistryAccess(undefined, projectDir);

    try {
      if (sourcepath) {
        logger.debug(`Building ComponentSet from sourcepath: ${sourcepath.join(', ')}`);
        const fsPaths = sourcepath.map(validateAndResolvePath);
        componentSet = ComponentSet.fromSource({
          fsPaths,
          registry: registryAccess,
        });
      }

      // Return empty ComponentSet and use packageNames in the connection via `.retrieve` options
      if (packagenames) {
        logger.debug(`Building ComponentSet for packagenames: ${packagenames.toString()}`);
        componentSet ??= new ComponentSet(undefined, registryAccess);
      }

      // Resolve manifest with source in package directories.
      if (manifest) {
        logger.debug(`Building ComponentSet from manifest: ${manifest.manifestPath}`);
        assertFileExists(manifest.manifestPath);

        logger.debug(`Searching in packageDir: ${manifest.directoryPaths.join(', ')} for matching metadata`);
        componentSet = await ComponentSet.fromManifest({
          manifestPath: manifest.manifestPath,
          resolveSourcePaths: manifest.directoryPaths,
          forceAddWildcards: true,
          destructivePre: manifest.destructiveChangesPre,
          destructivePost: manifest.destructiveChangesPost,
          registry: registryAccess,
        });
      }

      // Resolve metadata entries with source in package directories.
      if (metadata) {
        logger.debug(`Building ComponentSet from metadata: ${metadata.metadataEntries.toString()}`);
        const directoryPaths = metadata.directoryPaths;
        componentSet ??= new ComponentSet(undefined, registryAccess);
        const componentSetFilter = new ComponentSet(undefined, registryAccess);

        // Build a Set of metadata entries
        metadata.metadataEntries
          .map(entryToTypeAndName(registryAccess))
          .flatMap(typeAndNameToMetadataComponents({ directoryPaths, registry: registryAccess }))
          .map(addToComponentSet(componentSet))
          .map(addToComponentSet(componentSetFilter));

        logger.debug(`Searching for matching metadata in directories: ${directoryPaths.join(', ')}`);

        // add destructive changes if defined. Because these are deletes, all entries
        // are resolved to SourceComponents
        if (metadata.destructiveEntriesPre) {
          metadata.destructiveEntriesPre
            .map(entryToTypeAndName(registryAccess))
            .map(assertNoWildcardInDestructiveEntries)
            .flatMap(typeAndNameToMetadataComponents({ directoryPaths, registry: registryAccess }))
            .map((mdComponent) => new SourceComponent({ type: mdComponent.type, name: mdComponent.fullName }))
            .map(addToComponentSet(componentSet, DestructiveChangesType.PRE));
        }
        if (metadata.destructiveEntriesPost) {
          metadata.destructiveEntriesPost
            .map(entryToTypeAndName(registryAccess))
            .map(assertNoWildcardInDestructiveEntries)
            .flatMap(typeAndNameToMetadataComponents({ directoryPaths, registry: registryAccess }))
            .map((mdComponent) => new SourceComponent({ type: mdComponent.type, name: mdComponent.fullName }))
            .map(addToComponentSet(componentSet, DestructiveChangesType.POST));
        }

        const resolvedComponents = ComponentSet.fromSource({
          fsPaths: directoryPaths,
          include: componentSetFilter,
          registry: registryAccess,
        });

        if (resolvedComponents.forceIgnoredPaths) {
          // if useFsForceIgnore = true, then we won't be able to resolve a forceignored path,
          // which we need to do to get the ignored source component
          const resolver = new MetadataResolver(registryAccess, undefined, false);

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
        componentSet ??= new ComponentSet(undefined, registryAccess);

        logger.debug(
          `Building ComponentSet from targetUsername: ${org.username} ${
            metadata ? `filtered by metadata: ${metadata.metadataEntries.toString()}` : ''
          }`
        );

        const mdMap = metadata
          ? buildMapFromComponents(metadata.metadataEntries.map(entryToTypeAndName(registryAccess)))
          : (new Map() as MetadataMap);

        const fromConnection = await ComponentSet.fromConnection({
          usernameOrConnection: (await StateAggregator.getInstance()).aliases.getUsername(org.username) ?? org.username,
          componentFilter: getOrgComponentFilter(org, mdMap, metadata),
          metadataTypes: mdMap.size ? Array.from(mdMap.keys()) : undefined,
          registry: registryAccess,
        });

        fromConnection.toArray().map(addToComponentSet(componentSet));
      }
    } catch (e) {
      return componentSetBuilderErrorHandler(e);
    }

    // there should have been a componentSet created by this point.
    componentSet = assertComponentSetIsNotUndefined(componentSet);
    componentSet.apiVersion ??= apiversion;
    componentSet.sourceApiVersion ??= sourceapiversion;
    componentSet.projectDirectory = projectDir;

    logComponents(logger, componentSet);
    return componentSet;
  }
}

const addToComponentSet =
  (cs: ComponentSet, deletionType?: DestructiveChangesType) =>
  (cmp: MetadataComponent): MetadataComponent => {
    cs.add(cmp, deletionType);
    return cmp;
  };

const componentSetBuilderErrorHandler = (e: unknown): never => {
  if (e instanceof Error && e.message.includes('Missing metadata type definition in registry for id')) {
    // to remain generic to catch missing metadata types regardless of parameters, split on '
    // example message : Missing metadata type definition in registry for id 'NonExistentType'
    const issueType = e.message.split("'")[1];
    throw new SfError(`The specified metadata type is unsupported: [${issueType}]`);
  } else {
    throw e;
  }
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
const logComponents = (logger: Logger, componentSet: ComponentSet): void => {
  logger.debug(`Matching metadata files (${componentSet.size}):`);

  const components = componentSet.getSourceComponents().toArray();

  components
    .slice(0, 20)
    .map((cmp) => cmp.content ?? cmp.xml ?? cmp.fullName)
    .map((m) => logger.debug(m));
  if (components.length > 20) logger.debug(`(showing 20 of ${componentSet.size} matches)`);

  logger.debug(`ComponentSet apiVersion = ${componentSet.apiVersion}`);
  logger.debug(`ComponentSet sourceApiVersion = ${componentSet.sourceApiVersion}`);
};

const getOrgComponentFilter = (
  org: OrgOption,
  mdMap: MetadataMap,
  metadata?: MetadataOption
): FromConnectionOptions['componentFilter'] =>
  metadata
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
    const parent = reg.getParentType(type.name);
    // If a user is requesting a child type that is unaddressable (more common with custom registries to create proper behavior)
    // throw an error letting them know to use the entire parent instead
    // or if they're requesting a COFT, unadressable without parent, don't throw because the parent could be requested - we don't know at this point
    if (type.isAddressable === false && parent !== undefined && !type.unaddressableWithoutParent) {
      throw new Error(`Cannot use this type, instead use ${parent.name}`);
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

// TODO: use Map.groupBy when it's available
const buildMapFromComponents = (components: MetadataTypeAndMetadataName[]): MetadataMap => {
  const mdMap: MetadataMap = new Map<string, string[]>();
  components.map((cmp) => {
    mdMap.set(cmp.type.name, [...(mdMap.get(cmp.type.name) ?? []), cmp.metadataName]);
  });
  return mdMap;
};
