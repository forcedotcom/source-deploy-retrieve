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
import { isString, JsonMap } from '@salesforce/ts-types';
import fs from 'graceful-fs';
import { XMLBuilder } from 'fast-xml-parser';
import { XML_DECL } from '../common';
import { ConvertOutputConfig, MetadataConverter } from '../convert';
import { ComponentSet } from '../collections';
import { ZipTreeContainer } from '../resolve';
import { SourceComponent, SourceComponentWithContent } from '../resolve/sourceComponent';
import { fnJoin } from '../utils/path';
import { correctComments, handleSpecialEntities } from '../convert/streams';
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
    // Early exit: only process if there are Bot or GenAiPlannerBundle components
    const hasRelevantComponents = retrievedComponents.some(
      (comp) => comp.type.name === 'Bot' || comp.type.name === 'GenAiPlannerBundle'
    );

    if (hasRelevantComponents) {
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
        if (allBotNames.size > 0) {
          filtersToUse = Array.from(allBotNames).map((botName) => ({
            botName,
            versionFilter: 'highest',
          }));
        }
      }

      if (filtersToUse && filtersToUse.length > 0) {
        // eslint-disable-next-line no-await-in-loop
        retrievedComponents = await filterAgentComponents(retrievedComponents, filtersToUse);
      }
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
 *
 * @internal Exported for testing purposes
 */
export function extractVersionNumber(fullName: string): number | null {
  // Match patterns like "v0", "v1", "v2" or just "0", "1", "2"
  const versionMatch = fullName.match(/^v?(\d+)$/);
  if (versionMatch) {
    return parseInt(versionMatch[1], 10);
  }
  return null;
}

/**
 * Determines if a version number matches the filter criteria.
 * Shared logic for both Bot and GenAiPlannerBundle filtering.
 *
 * @param versionNum The version number to check
 * @param versionFilter The filter criteria ('all', 'highest', or specific number)
 * @param highestVersion The highest version number (required when filter is 'highest')
 * @returns true if the version should be kept, false otherwise
 * @internal Exported for testing purposes
 */
export function versionMatchesFilter(
  versionNum: number,
  versionFilter: 'all' | 'highest' | number,
  highestVersion?: number
): boolean {
  if (versionFilter === 'all') {
    return true;
  }
  if (versionFilter === 'highest') {
    return highestVersion !== undefined && versionNum === highestVersion;
  }
  // Specific version number
  return versionNum === versionFilter;
}

/**
 * Filters BotVersion entries from a Bot XML based on version filter criteria.
 *
 * @internal Exported for testing purposes
 */
export function filterBotVersionEntries(
  botVersions: Array<{ fullName?: string }>,
  versionFilter: 'all' | 'highest' | number
): Array<{ fullName?: string }> {
  if (versionFilter === 'all') {
    return botVersions;
  }

  // Extract version numbers and find highest if needed
  const versionsWithNumbers: Array<{ version: { fullName?: string }; versionNum: number; index: number }> = [];
  let highestVersion = -1;

  for (let i = 0; i < botVersions.length; i++) {
    const version = botVersions[i];
    if (version?.fullName) {
      const versionNum = extractVersionNumber(version.fullName);
      if (versionNum !== null) {
        versionsWithNumbers.push({ version, versionNum, index: i });
        if (versionNum > highestVersion) {
          highestVersion = versionNum;
        }
      }
    }
  }

  // Filter using shared logic
  return versionsWithNumbers
    .filter(({ versionNum }) => versionMatchesFilter(versionNum, versionFilter, highestVersion))
    .map(({ version }) => version);
}

/**
 * Filters Bot and GenAiPlannerBundle components based on botVersionFilters.
 * For Bot components: modifies XML to filter BotVersion entries.
 * For GenAiPlannerBundle components: removes components that don't match filter criteria.
 *
 * @param components Retrieved source components
 * @param botVersionFilters Version filter rules for bots
 * @returns Components with filtered BotVersion entries and GenAiPlannerBundle components
 * @internal Exported for testing purposes
 */
// WeakMap to store normalized Bot XML structures for components that have been filtered
// This allows us to return the normalized structure when parseXml is called
const normalizedBotXmlMap = new WeakMap<SourceComponent, JsonMap>();

export async function filterAgentComponents(
  components: SourceComponent[],
  botVersionFilters: BotVersionFilter[]
): Promise<SourceComponent[]> {
  const filterMap = new Map<string, BotVersionFilter>();
  for (const filter of botVersionFilters) {
    const botFilter: BotVersionFilter = filter;
    filterMap.set(botFilter.botName, botFilter);
  }

  // Pre-compute which bots need 'highest' filtering
  const botsNeedingHighest = new Set<string>();
  for (const filter of botVersionFilters) {
    const botFilter: BotVersionFilter = filter;
    if (botFilter.versionFilter === 'highest') {
      botsNeedingHighest.add(botFilter.botName);
    }
  }

  // Single pass: pre-compute highest versions, collect Bot components for async processing,
  // and collect GenAiPlannerBundle components for filtering
  const highestVersions = new Map<string, number>();
  const botComponents: SourceComponent[] = [];
  const genAiPlannerBundles: SourceComponent[] = [];
  const filtered: SourceComponent[] = [];

  for (const comp of components) {
    if (comp.type.name === 'Bot') {
      // Collect Bot components for async processing
      botComponents.push(comp);
      // Include in result (will be modified in place)
      filtered.push(comp);
    } else if (comp.type.name === 'GenAiPlannerBundle') {
      // Collect for filtering after we know highest versions
      genAiPlannerBundles.push(comp);
      // Pre-compute highest versions
      const nameMatch = comp.fullName.match(/^(.+)_v(\d+)$/);
      if (nameMatch) {
        const botName = nameMatch[1];
        const versionNum = parseInt(nameMatch[2], 10);
        if (botsNeedingHighest.has(botName)) {
          const currentHighest = highestVersions.get(botName) ?? -1;
          if (versionNum > currentHighest) {
            highestVersions.set(botName, versionNum);
          }
        }
      }
    } else {
      // Not a Bot or GenAiPlannerBundle, keep it
      filtered.push(comp);
    }
  }

  // Filter GenAiPlannerBundle components now that we have final highest versions
  for (const comp of genAiPlannerBundles) {
    const nameMatch = comp.fullName.match(/^(.+)_v(\d+)$/);
    if (nameMatch) {
      const botName = nameMatch[1];
      const versionNum = parseInt(nameMatch[2], 10);
      const matchingFilter = filterMap.get(botName);
      if (matchingFilter) {
        const highestVersion = matchingFilter.versionFilter === 'highest' ? highestVersions.get(botName) : undefined;
        const shouldKeep = versionMatchesFilter(versionNum, matchingFilter.versionFilter, highestVersion);
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
  }

  // Process Bot components in parallel (XML parsing is async)
  const botPromises = botComponents.map(async (comp) => {
    const matchingFilter = filterMap.get(comp.fullName);
    if (matchingFilter && comp.xml) {
      try {
        // Parse the Bot XML to get BotVersion entries
        const botXml = await comp.parseXml<{
          Bot?: { botVersions?: Array<{ fullName?: string }> | { fullName?: string | string[] } };
        }>();
        const rawBotVersions = botXml.Bot?.botVersions;

        // Normalize the structure: XMLParser may group multiple <fullName> elements into { fullName: ['v1', 'v2'] }
        // but we need [{ fullName: 'v1' }, { fullName: 'v2' }] format
        let normalizedBotVersions: Array<{ fullName?: string }> = [];
        if (rawBotVersions) {
          if (Array.isArray(rawBotVersions)) {
            // Already in the correct format
            normalizedBotVersions = rawBotVersions;
          } else if (typeof rawBotVersions === 'object' && 'fullName' in rawBotVersions) {
            // XMLParser grouped format: { fullName: ['v1', 'v2'] }
            const fullNameValue = rawBotVersions.fullName;
            if (Array.isArray(fullNameValue)) {
              normalizedBotVersions = fullNameValue.map((fn) => ({ fullName: fn }));
            } else if (typeof fullNameValue === 'string') {
              normalizedBotVersions = [{ fullName: fullNameValue }];
            }
          }
        }

        if (normalizedBotVersions.length > 0) {
          const filteredVersions = filterBotVersionEntries(normalizedBotVersions, matchingFilter.versionFilter);

          // Extract fullNames and reconstruct the object in the correct format
          const fullNames = filteredVersions.map((v) => v.fullName).filter((f): f is string => !!f);

          // Reconstruct Bot XML with filtered versions
          // We manually construct the botVersions section to avoid XMLParser grouping
          if (botXml.Bot) {
            // Update the component's cached XML content
            // Build XML string using XMLBuilder, but manually construct botVersions section
            // to avoid XMLParser grouping multiple <fullName> elements
            const builder = new XMLBuilder({
              format: true,
              indentBy: '    ',
              ignoreAttributes: false,
            });

            // Build XML with botVersions structure
            // XMLBuilder creates multiple <fullName> elements, XMLParser groups them into { fullName: ['v1', 'v2'] }
            // The transformer expects [{ fullName: 'v1' }, { fullName: 'v2' }]
            // We need to normalize this when the XML is parsed, but we can't modify the transformer
            // So we store a normalized version in pathContentMap and intercept parseXml calls
            const botWithVersions = {
              Bot: {
                ...botXml.Bot,
                botVersions:
                  fullNames.length > 0 ? { fullName: fullNames.length === 1 ? fullNames[0] : fullNames } : undefined,
              },
            };
            const builtXml = String(builder.build(botWithVersions));
            const xmlContent = correctComments(XML_DECL.concat(handleSpecialEntities(builtXml)));

            // Store normalized structure for later parsing
            // We'll intercept parseXml to return the normalized structure
            const normalizedBotVersionsForXml = fullNames.map((fn) => ({ fullName: fn }));
            const normalizedBotXml = {
              ...botXml,
              Bot: {
                ...botXml.Bot,
                botVersions: normalizedBotVersionsForXml,
              },
            };

            // Store both the XML content and the normalized structure
            if (comp.pathContentMap && comp.xml) {
              comp.pathContentMap.set(comp.xml, xmlContent);
              // Store normalized structure in WeakMap for this component
              normalizedBotXmlMap.set(comp, normalizedBotXml as JsonMap);

              // Intercept parseXml to return normalized structure for Bot components
              const originalParseXml = comp.parseXml.bind(comp);
              comp.parseXml = async <T extends JsonMap>(xmlFilePath?: string): Promise<T> => {
                const xml = xmlFilePath ?? comp.xml;
                if (xml === comp.xml) {
                  const normalized = normalizedBotXmlMap.get(comp);
                  if (normalized) {
                    // Return normalized structure for this Bot component
                    return normalized as T;
                  }
                }
                // For other cases, use original parseXml
                return originalParseXml<T>(xmlFilePath);
              };
            }

            if (comp.pathContentMap && comp.xml) {
              comp.pathContentMap.set(comp.xml, xmlContent);
            }
          }
        }
      } catch (error) {
        // Continue with unfiltered component if there's an error
      }
    }
    return comp;
  });

  await Promise.all(botPromises);

  return filtered;
}
