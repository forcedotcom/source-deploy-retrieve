/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint complexity: ["error", 22] */

import * as path from 'node:path';
import { StateAggregator, Logger, SfError, Messages } from '@salesforce/core';
import * as fs from 'graceful-fs';
import * as minimatch from 'minimatch';
import { ComponentSet } from '../collections';
import { RegistryAccess } from '../registry';
import { FileProperties } from '../client';

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

    /**
     * A map used when building a ComponentSet from metadata type/name pairs
     * key = a metadata type, e.g. `ApexClass`
     * value = an array of metadata names, e.g. `['foo_*', 'BarClass']`
     */
    const mdMap = new Map<string, string[]>();

    const { sourcepath, manifest, metadata, packagenames, apiversion, sourceapiversion, org, projectDir } = options;
    const registryAccess = new RegistryAccess(undefined, projectDir);

    try {
      if (sourcepath) {
        logger.debug(`Building ComponentSet from sourcepath: ${sourcepath.join(', ')}`);
        const fsPaths: string[] = sourcepath.map((filepath) => {
          if (!fs.existsSync(filepath)) {
            throw new SfError(messages.getMessage('error_path_not_found', [filepath]));
          }
          return path.resolve(filepath);
        });
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
        if (!fs.existsSync(manifest.manifestPath)) {
          throw new SfError(messages.getMessage('error_path_not_found', [manifest.manifestPath]));
        }
        const directoryPaths = manifest.directoryPaths;
        logger.debug(`Searching in packageDir: ${directoryPaths.join(', ')} for matching metadata`);
        componentSet = await ComponentSet.fromManifest({
          manifestPath: manifest.manifestPath,
          resolveSourcePaths: directoryPaths,
          forceAddWildcards: true,
          destructivePre: manifest.destructiveChangesPre,
          destructivePost: manifest.destructiveChangesPost,
          registry: registryAccess,
        });
      }

      // Resolve metadata entries with source in package directories.
      if (metadata) {
        logger.debug(`Building ComponentSet from metadata: ${metadata.metadataEntries.toString()}`);
        const compSetFilter = new ComponentSet(undefined, registryAccess);
        componentSet ??= new ComponentSet(undefined, registryAccess);
        const directoryPaths = metadata.directoryPaths;

        // Build a Set of metadata entries
        metadata.metadataEntries.forEach((rawEntry) => {
          const [mdType, mdName] = rawEntry.split(':').map((entry) => entry.trim());
          // The registry will throw if it doesn't know what this type is.
          registryAccess.getTypeByName(mdType);

          // Add metadata entries to a map for possible use with an org connection below.
          const mdMapEntry = mdMap.get(mdType);
          if (mdMapEntry) {
            mdMapEntry.push(mdName);
          } else {
            mdMap.set(mdType, [mdName]);
          }

          // this '.*' is a surprisingly valid way to specify a metadata, especially a DEB :sigh:
          // https://github.com/salesforcecli/plugin-deploy-retrieve/blob/main/test/nuts/digitalExperienceBundle/constants.ts#L140
          // because we're filtering from what we have locally, this won't allow you to retrieve new metadata (on the server only) using the partial wildcard
          // to do that, you'd need check the size of the CS created below, see if it's 0, and then query the org for the metadata that matches the regex
          // but building a CS from a metadata argument doesn't require an org, so we can't do that here
          if (mdName?.includes('*') && mdName?.length > 1 && !mdName.includes('.*')) {
            // get all components of the type, and then filter by the regex of the fullName
            ComponentSet.fromSource({
              fsPaths: directoryPaths,
              include: new ComponentSet([{ type: mdType, fullName: ComponentSet.WILDCARD }]),
              registry: registryAccess,
            })
              .getSourceComponents()
              .toArray()
              // using minimatch versus RegExp provides better (more expected) matching results
              .filter((cs) => minimatch(cs.fullName, mdName))
              .map((match) => {
                compSetFilter.add(match);
                componentSet?.add(match);
              });
          } else {
            const entry = {
              type: mdType,
              fullName: !mdName ? '*' : mdName,
            };
            // Add to the filtered ComponentSet for resolved source paths,
            // and the unfiltered ComponentSet to build the correct manifest.
            compSetFilter.add(entry);
            componentSet?.add(entry);
          }
        });

        logger.debug(`Searching for matching metadata in directories: ${directoryPaths.join(', ')}`);
        const resolvedComponents = ComponentSet.fromSource({
          fsPaths: directoryPaths,
          include: compSetFilter,
          registry: registryAccess,
        });
        componentSet.forceIgnoredPaths = resolvedComponents.forceIgnoredPaths;
        for (const comp of resolvedComponents) {
          componentSet.add(comp);
        }
      }

      // Resolve metadata entries with an org connection
      if (org) {
        componentSet ??= new ComponentSet(undefined, registryAccess);

        let debugMsg = `Building ComponentSet from targetUsername: ${org.username}`;

        // *** Default Filter ***
        // exclude components based on the results of componentFilter function
        // components with namespacePrefix where org.exclude includes manageableState (to exclude managed packages)
        // components with namespacePrefix where manageableState equals undefined (to exclude components e.g. InstalledPackage)
        // components where org.exclude includes manageableState (to exclude packages without namespacePrefix e.g. unlocked packages)
        let componentFilter = (component: Partial<FileProperties>): boolean =>
          !component?.manageableState || !org.exclude?.includes(component.manageableState);

        if (metadata) {
          debugMsg += ` filtered by metadata: ${metadata.metadataEntries.toString()}`;

          componentFilter = (component: Partial<FileProperties>): boolean => {
            if (component.type && component.fullName) {
              const mdMapEntry = mdMap.get(component.type);
              // using minimatch versus RegExp provides better (more expected) matching results
              return !!mdMapEntry && mdMapEntry.some((mdName) => minimatch(component.fullName as string, mdName));
            }
            return false;
          };
        }

        logger.debug(debugMsg);
        const fromConnection = await ComponentSet.fromConnection({
          usernameOrConnection: (await StateAggregator.getInstance()).aliases.getUsername(org.username) ?? org.username,
          componentFilter,
          metadataTypes: mdMap.size ? Array.from(mdMap.keys()) : undefined,
          registry: registryAccess,
        });

        for (const comp of fromConnection) {
          componentSet.add(comp);
        }
      }
    } catch (e) {
      if ((e as Error).message.includes('Missing metadata type definition in registry for id')) {
        // to remain generic to catch missing metadata types regardless of parameters, split on '
        // example message : Missing metadata type definition in registry for id 'NonExistentType'
        const issueType = (e as Error).message.split("'")[1];
        throw new SfError(`The specified metadata type is unsupported: [${issueType}]`);
      } else {
        throw e;
      }
    }

    // This is only for debug output of matched files based on the command flags.
    // It will log up to 20 file matches.
    if (logger.shouldLog(20) && componentSet?.size) {
      logger.debug(`Matching metadata files (${componentSet.size}):`);
      const components = componentSet.getSourceComponents().toArray();
      for (let i = 0; i < componentSet.size; i++) {
        if (components[i]?.content) {
          logger.debug(components[i].content);
        } else if (components[i]?.xml) {
          logger.debug(components[i].xml);
        }

        if (i > 18) {
          logger.debug(`(showing 20 of ${componentSet.size} matches)`);
          break;
        }
      }
    }

    // there should have been a componentSet created by this point.
    if (componentSet === undefined) {
      throw new SfError('undefinedComponentSet');
    }

    componentSet.apiVersion ??= apiversion;
    componentSet.sourceApiVersion ??= sourceapiversion;
    logger.debug(`ComponentSet apiVersion = ${componentSet.apiVersion}`);
    logger.debug(`ComponentSet sourceApiVersion = ${componentSet.sourceApiVersion}`);

    return componentSet;
  }
}
