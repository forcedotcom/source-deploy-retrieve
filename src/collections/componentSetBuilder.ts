/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint complexity: ["error", 22] */

import * as path from 'path';
import { StateAggregator, Logger, SfError, Messages } from '@salesforce/core';
import * as fs from 'graceful-fs';
import { ComponentSet } from '../collections';
import { RegistryAccess } from '../registry';

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

    const { sourcepath, manifest, metadata, packagenames, apiversion, sourceapiversion, org } = options;
    try {
      if (sourcepath) {
        logger.debug(`Building ComponentSet from sourcepath: ${sourcepath.join(', ')}`);
        const fsPaths: string[] = sourcepath.map((filepath) => {
          if (!fs.existsSync(filepath)) {
            throw new SfError(messages.getMessage('error_path_not_found', [filepath]));
          }
          return path.resolve(filepath);
        });
        componentSet = ComponentSet.fromSource({ fsPaths });
      }

      // Return empty ComponentSet and use packageNames in the connection via `.retrieve` options
      if (packagenames) {
        logger.debug(`Building ComponentSet for packagenames: ${packagenames.toString()}`);
        componentSet ??= new ComponentSet();
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
        });
      }

      // Resolve metadata entries with source in package directories.
      if (metadata) {
        logger.debug(`Building ComponentSet from metadata: ${metadata.metadataEntries.toString()}`);
        const registry = new RegistryAccess();
        const compSetFilter = new ComponentSet();
        componentSet ??= new ComponentSet();
        const directoryPaths = metadata.directoryPaths;

        // Build a Set of metadata entries
        metadata.metadataEntries.forEach((rawEntry) => {
          const splitEntry = rawEntry.split(':').map((entry) => entry.trim());
          // The registry will throw if it doesn't know what this type is.
          registry.getTypeByName(splitEntry[0]);

          // if there's a better way to detect
          if (splitEntry[1]?.includes('*')) {
            // get all components of the type, and then filter by the regex of the fullName
            ComponentSet.fromSource({
              fsPaths: directoryPaths,
              include: new ComponentSet([{ type: splitEntry[0], fullName: ComponentSet.WILDCARD }]),
            })
              .getSourceComponents()
              .toArray()
              .filter((cs) => Boolean(cs.fullName.match(new RegExp(splitEntry[1].replace('*', '.*')))))
              .map((match) => {
                compSetFilter.add(match);
                componentSet?.add(match);
              });
          } else {
            const entry = {
              type: splitEntry[0],
              fullName: splitEntry.length === 1 ? '*' : splitEntry[1],
            };
            // Add to the filtered ComponentSet for resolved source paths,
            // and the unfiltered ComponentSet to build the correct manifest.
            compSetFilter.add(entry);
            componentSet?.add(entry);
          }
        });

        logger.debug(`Searching for matching metadata in directories: ${directoryPaths.join(', ')}`);
        const resolvedComponents = ComponentSet.fromSource({ fsPaths: directoryPaths, include: compSetFilter });
        componentSet.forceIgnoredPaths = resolvedComponents.forceIgnoredPaths;
        for (const comp of resolvedComponents) {
          componentSet.add(comp);
        }
      }

      // Resolve metadata entries with an org connection
      if (org) {
        componentSet ??= new ComponentSet();
        logger.debug(`Building ComponentSet from targetUsername: ${org.username}`);
        const fromConnection = await ComponentSet.fromConnection({
          usernameOrConnection: (await StateAggregator.getInstance()).aliases.getUsername(org.username) ?? org.username,
          // exclude components based on the results of componentFilter function
          // components with namespacePrefix where org.exclude includes manageableState (to exclude managed packages)
          // components with namespacePrefix where manageableState equals undefined (to exclude components e.g. InstalledPackage)
          // components where org.exclude includes manageableState (to exclude packages without namespacePrefix e.g. unlocked packages)
          componentFilter: (component): boolean =>
            !component?.manageableState || !org.exclude?.includes(component.manageableState),
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
    if (logger.debugEnabled && componentSet?.size) {
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
