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
import { Logger } from '@salesforce/core/logger';
import { isString } from '@salesforce/ts-types';
import fs from 'graceful-fs';
import { ConvertOutputConfig } from '../convert/types';
import { MetadataConverter } from '../convert/metadataConverter';
import { ComponentSet } from '../collections/componentSet';
import { ZipTreeContainer } from '../resolve/treeContainers';
import { SourceComponent, SourceComponentWithContent } from '../resolve/sourceComponent';
import { fnJoin } from '../utils/path';
import {
  BotVersionFilter,
  ComponentStatus,
  FileResponse,
  FileResponseSuccess,
  PackageOption,
  PackageOptions,
} from './types';
import { MetadataApiRetrieveOptions } from './types';

export const extract = async ({
  zip,
  options,
  logger,
  mainComponents,
}: {
  zip: Buffer;
  options: MetadataApiRetrieveOptions;
  logger: Logger;
  mainComponents?: ComponentSet;
}): Promise<{ componentSet: ComponentSet; partialDeleteFileResponses: FileResponse[] }> => {
  const components: SourceComponent[] = [];
  const { merge, output, registry, botVersionFilters } = options;
  const converter = new MetadataConverter(registry);
  const tree = await ZipTreeContainer.create(zip);

  const partialDeleteFileResponses = [];

  const packages = [
    { zipTreeLocation: 'unpackaged', outputDir: output },
    ...getPackageOptions(options.packageOptions).map(({ name, outputDir }) => ({
      zipTreeLocation: name,
      outputDir,
    })),
  ];

  for (const pkg of packages) {
    const outputConfig: ConvertOutputConfig = merge
      ? {
          type: 'merge',
          mergeWith: mainComponents?.getSourceComponents() ?? [],
          defaultDirectory: pkg.outputDir,
          forceIgnoredPaths: mainComponents?.forceIgnoredPaths ?? new Set<string>(),
        }
      : {
          type: 'directory',
          outputDirectory: pkg.outputDir,
        };
    let retrievedComponents = ComponentSet.fromSource({
      fsPaths: [pkg.zipTreeLocation],
      registry,
      tree,
    })
      .getSourceComponents()
      .toArray();

    // Filter BotVersion components and GenAiPlannerBundle components right after retrieval
    // This is needed when rootTypesWithDependencies is used, as it will retrieve all BotVersions
    // and GenAiPlannerBundles regardless of what's in the manifest.
    // If botVersionFilters is undefined, default to 'highest' for all Bot components
    let filtersToUse = botVersionFilters && Array.isArray(botVersionFilters) ? botVersionFilters : undefined;
    if (!filtersToUse || filtersToUse.length === 0) {
      // No filters specified - default to 'highest' for all Bot components
      const allBotNames = new Set<string>();
      for (const comp of retrievedComponents) {
        if (comp.type.name === 'Bot') {
          allBotNames.add(comp.fullName);
        }
      }
      filtersToUse = Array.from(allBotNames).map((botName) => ({
        botName,
        versionFilter: 'highest',
      }));
    }

    if (filtersToUse && filtersToUse.length > 0) {
      // eslint-disable-next-line no-await-in-loop
      retrievedComponents = await filterBotVersionsFromRetrievedComponents(retrievedComponents, filtersToUse);
      // Filter GenAiPlannerBundle components based on version filters
      retrievedComponents = filterGenAiPlannerBundles(retrievedComponents, filtersToUse);
    }

    if (merge) {
      partialDeleteFileResponses.push(
        ...handlePartialDeleteMerges({ retrievedComponents, tree, mainComponents, logger })
      );
    }

    // this is intentional sequential
    // eslint-disable-next-line no-await-in-loop
    const convertResult = await converter.convert(retrievedComponents, 'source', outputConfig);
    components.push(...(convertResult?.converted ?? []));
    // additional partialDelete logic for decomposed types are handled in the transformer
    partialDeleteFileResponses.push(...(convertResult?.deleted ?? []));
  }
  return { componentSet: new ComponentSet(components, registry), partialDeleteFileResponses };
};

export const getPackageOptions = (packageOptions?: PackageOptions): Array<Required<PackageOption>> =>
  (packageOptions ?? []).map((po: string | PackageOption) =>
    isString(po) ? { name: po, outputDir: po } : { name: po.name, outputDir: po.outputDir ?? po.name }
  );

// Some bundle-like components can be partially deleted in the org, then retrieved. When this
// happens, the deleted files need to be deleted on the file system and added to the FileResponses
// that are returned by `RetrieveResult.getFileResponses()` for accuracy. The component types that
// support this behavior are defined in the metadata registry with `"supportsPartialDelete": true`.
// However, not all types can be partially deleted in the org. Currently this only applies to
// DigitalExperienceBundle and ExperienceBundle.
// side effect: deletes files
const handlePartialDeleteMerges = ({
  mainComponents,
  retrievedComponents,
  tree,
  logger,
}: {
  mainComponents?: ComponentSet;
  retrievedComponents: SourceComponent[];
  tree: ZipTreeContainer;
  logger: Logger;
}): FileResponse[] => {
  // Find all merge (local) components that support partial delete.
  const partialDeleteComponents = new Map<string, PartialDeleteComp>(
    (mainComponents?.getSourceComponents().toArray() ?? [])
      .filter(supportsPartialDeleteAndHasContent)
      .map((comp) => [comp.fullName, { contentPath: comp.content, contentList: fs.readdirSync(comp.content) }])
  );

  // Compare the contents of the retrieved components that support partial delete with the
  // matching merge components. If the merge components have files that the retrieved components
  // don't, delete the merge component and add all locally deleted files to the partial delete list
  // so that they are added to the `FileResponses` as deletes.
  return partialDeleteComponents.size === 0
    ? [] // If no partial delete components were in the mergeWith ComponentSet, no need to continue.
    : retrievedComponents
        .filter(supportsPartialDeleteAndIsInMap(partialDeleteComponents))
        .filter((comp) => partialDeleteComponents.get(comp.fullName)?.contentPath)
        .filter(supportsPartialDeleteAndHasZipContent(tree))
        .flatMap((comp) => {
          // asserted to be defined by the filter above
          const matchingLocalComp = partialDeleteComponents.get(comp.fullName)!;
          const remoteContentList = new Set(tree.readDirectory(comp.content));

          return matchingLocalComp.contentList
            .filter((fileName) => !remoteContentList.has(fileName))
            .filter((fileName) => !pathOrSomeChildIsIgnored(logger)(comp)(matchingLocalComp)(fileName))
            .map(
              (fileName): FileResponseSuccess => ({
                fullName: comp.fullName,
                type: comp.type.name,
                state: ComponentStatus.Deleted,
                filePath: path.join(matchingLocalComp.contentPath, fileName),
              })
            )
            .map(deleteFilePath(logger));
        });
};

const supportsPartialDeleteAndHasContent = (comp: SourceComponent): comp is SourceComponentWithContent =>
  supportsPartialDelete(comp) && typeof comp.content === 'string' && fs.statSync(comp.content).isDirectory();

const supportsPartialDeleteAndHasZipContent =
  (tree: ZipTreeContainer) =>
  (comp: SourceComponent): comp is SourceComponentWithContent =>
    supportsPartialDelete(comp) && typeof comp.content === 'string' && tree.isDirectory(comp.content);

const supportsPartialDeleteAndIsInMap =
  (partialDeleteComponents: Map<string, PartialDeleteComp>) =>
  (comp: SourceComponent): boolean =>
    supportsPartialDelete(comp) && partialDeleteComponents.has(comp.fullName);

const supportsPartialDelete = (comp: SourceComponent): boolean => comp.type.supportsPartialDelete === true;

type PartialDeleteComp = {
  contentPath: string;
  contentList: string[];
};

// If fileName is forceignored it is not counted as a diff. If fileName is a directory
// we have to read the contents to check forceignore status or we might get a false
// negative with `denies()` due to how the ignore library works.
const pathOrSomeChildIsIgnored =
  (logger: Logger) =>
  (component: SourceComponent) =>
  (localComp: PartialDeleteComp) =>
  (fileName: string): boolean => {
    const fileNameFullPath = path.join(localComp.contentPath, fileName);
    return fs.statSync(fileNameFullPath).isDirectory()
      ? fs.readdirSync(fileNameFullPath).map(fnJoin(fileNameFullPath)).some(isForceIgnored(logger)(component))
      : isForceIgnored(logger)(component)(fileNameFullPath);
  };

const isForceIgnored =
  (logger: Logger) =>
  (comp: SourceComponent) =>
  (filePath: string): boolean => {
    const ignored = comp.getForceIgnore().denies(filePath);
    if (ignored) {
      logger.debug(`Local component has ${filePath} while remote does not, but it is forceignored so ignoring.`);
    }
    return ignored;
  };

const deleteFilePath =
  (logger: Logger) =>
  (fr: FileResponseSuccess): FileResponseSuccess => {
    if (fr.filePath) {
      logger.debug(
        `Local component (${fr.fullName}) contains ${fr.filePath} while remote component does not. This file is being removed.`
      );
      fs.rmSync(fr.filePath, { recursive: true, force: true });
    }

    return fr;
  };

/**
 * Extracts version number from BotVersion fullName.
 * BotVersion fullName can be in formats like "v0", "v1", "v2" or "0", "1", "2"
 */
function extractVersionNumber(fullName: string): number | null {
  // Match patterns like "v0", "v1", "v2" or just "0", "1", "2"
  const versionMatch = fullName.match(/^v?(\d+)$/);
  if (versionMatch) {
    return parseInt(versionMatch[1], 10);
  }
  return null;
}

/**
 * Filters BotVersion entries from a Bot XML based on version filter criteria.
 */
function filterBotVersionEntries(
  botVersions: Array<{ fullName?: string }>,
  versionFilter: 'all' | 'highest' | number
): Array<{ fullName?: string }> {
  if (versionFilter === 'all') {
    return botVersions;
  }

  if (versionFilter === 'highest') {
    // Find the highest version number
    let highestVersion = -1;
    let highestIndex = -1;
    for (let i = 0; i < botVersions.length; i++) {
      const version = botVersions[i];
      if (version?.fullName) {
        const versionNum = extractVersionNumber(version.fullName);
        if (versionNum !== null && versionNum > highestVersion) {
          highestVersion = versionNum;
          highestIndex = i;
        }
      }
    }
    return highestIndex >= 0 ? [botVersions[highestIndex]] : [];
  }

  // Filter to specific version
  const versionNum = versionFilter;
  return botVersions.filter((version) => {
    if (version?.fullName) {
      const extractedVersion = extractVersionNumber(version.fullName);
      return extractedVersion !== null && extractedVersion === versionNum;
    }
    return false;
  });
}

/**
 * Filters BotVersion components from retrieved Bot components by modifying their XML content.
 * This removes unwanted BotVersion entries from the Bot component's XML before conversion.
 *
 * @param components Retrieved source components
 * @param botVersionFilters Version filter rules for bots
 * @returns Components with filtered BotVersion entries removed from Bot XML
 */
async function filterBotVersionsFromRetrievedComponents(
  components: SourceComponent[],
  botVersionFilters: BotVersionFilter[]
): Promise<SourceComponent[]> {
  const { XMLBuilder } = await import('fast-xml-parser');
  const { XML_DECL } = await import('../common/constants.js');

  // Helper functions (copied from streams.ts since they're not exported)
  const correctComments = (xml: string): string =>
    xml.includes('<!--') ? xml.replace(/\s+<!--(.*?)-->\s+/g, '<!--$1-->') : xml;
  const handleSpecialEntities = (xml: string): string => xml.replaceAll('&amp;#160;', '&#160;');

  // Process all Bot components in parallel
  const filteredPromises = components.map(async (comp) => {
    if (comp.type.name === 'Bot') {
      const matchingFilter = botVersionFilters.find((f) => f.botName === comp.fullName);
      if (matchingFilter && comp.xml) {
        try {
          // Parse the Bot XML to get BotVersion entries
          const botXml = await comp.parseXml<{ Bot?: { botVersions?: Array<{ fullName?: string }> } }>();
          const botVersions = botXml.Bot?.botVersions;

          if (botVersions && Array.isArray(botVersions)) {
            const filteredVersions = filterBotVersionEntries(botVersions, matchingFilter.versionFilter);

            // Update the Bot XML with filtered versions
            if (botXml.Bot) {
              botXml.Bot.botVersions = filteredVersions;
              // Update the component's cached XML content
              // Build XML string using XMLBuilder (same as JsToXml does internally)
              const builder = new XMLBuilder({
                format: true,
                indentBy: '    ',
                ignoreAttributes: false,
              });
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
              const builtXml = String(builder.build(botXml));
              const xmlContent = correctComments(XML_DECL.concat(handleSpecialEntities(builtXml)));
              const xmlString = xmlContent;
              // Update the private pathContentMap using type assertion to access private member
              // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
              const compWithPrivate = comp as any;
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
              if (compWithPrivate.pathContentMap && comp.xml) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                compWithPrivate.pathContentMap.set(comp.xml, xmlString);
              }
            }
          }
        } catch (error) {
          // Continue with unfiltered component if there's an error
        }
      }
    }
    return comp;
  });

  return Promise.all(filteredPromises);
}

/**
 * Filters GenAiPlannerBundle components based on botVersionFilters.
 * GenAiPlannerBundle names follow the pattern "BotName_v{N}" where N is the version number.
 * Only keeps GenAiPlannerBundles that match the filter criteria.
 *
 * @param components Retrieved source components
 * @param botVersionFilters Version filter rules for bots
 * @returns Components with filtered GenAiPlannerBundle components removed
 */
function filterGenAiPlannerBundles(
  components: SourceComponent[],
  botVersionFilters: BotVersionFilter[]
): SourceComponent[] {
  const filtered: SourceComponent[] = [];

  for (const comp of components) {
    if (comp.type.name === 'GenAiPlannerBundle') {
      // GenAiPlannerBundle names are like "MineToPublish_v2"
      // Extract bot name and version from the component name
      const nameMatch = comp.fullName.match(/^(.+)_v(\d+)$/);
      if (nameMatch) {
        const botName = nameMatch[1];
        const versionNum = parseInt(nameMatch[2], 10);
        // Find matching filter for this bot
        const matchingFilter = botVersionFilters.find((f) => f.botName === botName);
        if (matchingFilter) {
          let shouldKeep = false;

          if (matchingFilter.versionFilter === 'all') {
            shouldKeep = true;
          } else if (matchingFilter.versionFilter === 'highest') {
            // For highest, we need to find the highest version among all GenAiPlannerBundles for this bot
            const allVersionsForBot = components
              .filter((c) => c.type.name === 'GenAiPlannerBundle')
              .map((c) => {
                const match = c.fullName.match(/^(.+)_v(\d+)$/);
                if (match && match[1] === botName) {
                  return parseInt(match[2], 10);
                }
                return -1;
              })
              .filter((v) => v >= 0);
            const highestVersion = allVersionsForBot.length > 0 ? Math.max(...allVersionsForBot) : -1;
            shouldKeep = versionNum === highestVersion;
          } else {
            // Filter to specific version
            const targetVersion = typeof matchingFilter.versionFilter === 'number' ? matchingFilter.versionFilter : -1;
            shouldKeep = versionNum === targetVersion;
          }

          if (shouldKeep) {
            filtered.push(comp);
          }
        } else {
          // No filter for this bot, keep all GenAiPlannerBundles
          filtered.push(comp);
        }
      } else {
        // Name doesn't match expected pattern, keep it
        filtered.push(comp);
      }
    } else {
      // Not a GenAiPlannerBundle, keep it
      filtered.push(comp);
    }
  }

  return filtered;
}
