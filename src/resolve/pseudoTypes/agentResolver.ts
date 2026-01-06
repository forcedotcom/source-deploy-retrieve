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

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { Connection, Logger, SfError, validateSalesforceId } from '@salesforce/core';
import type { BotVersion, GenAiPlanner, GenAiPlannerFunctionDef, GenAiPlugin } from '@salesforce/types/metadata';
import { ensureArray } from '@salesforce/kit';
import { RegistryAccess } from '../../registry';
import { ComponentSet } from '../../collections/componentSet';
import { MetadataComponent } from '../types';

type BotVersionExt = {
  '?xml': { '@_version': '1.0'; '@_encoding': 'UTF-8' };
  BotVersion: BotVersion;
};

type GenAiPlannerExt = {
  '?xml': { '@_version': '1.0'; '@_encoding': 'UTF-8' };
  GenAiPlanner: GenAiPlanner;
};

type GenAiPluginExt = {
  '?xml': { '@_version': '1.0'; '@_encoding': 'UTF-8' };
  GenAiPlugin: GenAiPlugin;
};

let logger: Logger;
const getLogger = (): Logger => {
  if (!logger) {
    logger = Logger.childFromRoot('resolveAgentMdEntries');
  }
  return logger;
};

/**
 * This is the local "spidering" logic for agents.  Given the API name for a Bot,
 * and either an org connection or local file system paths, resolve to the top
 * level agent metadata. E.g., Bot, BotVersion, GenAiPlanner, GenAiPlugin, and
 * GenAiFunction.
 *
 * If an org connection is provided, it will query the org for GenAiPlanner and
 * GenAiPlugin metadata associated with the Bot name.
 *
 * If no org connection but directory paths are provided, it will search those
 * directory paths for BotVersion and GenAiPlanner metadata associated with the
 * Bot name.
 *
 * @param agentMdInfo Data necessary to get agent related metadata.
 * @returns An array of metadata types and possibly metadata names (Metadata entries)
 */
export async function resolveAgentMdEntries(agentMdInfo: {
  botName: string;
  directoryPaths?: string[];
  connection?: Connection;
  registry?: RegistryAccess;
}): Promise<string[]> {
  const { botName, connection, directoryPaths } = agentMdInfo;
  const v63topLevelMd = ['Bot', 'GenAiPlanner', 'GenAiPlugin', 'GenAiFunction'];
  const v64topLevelMd = ['Bot', 'GenAiPlannerBundle', 'GenAiPlugin', 'GenAiFunction'];

  let debugMsg = `Resolving agent metadata with botName: ${botName}`;
  if (connection) {
    debugMsg += ` and org connection ${connection.getUsername() as string}`;
  }
  if (directoryPaths) {
    debugMsg += ` in paths: ${directoryPaths.join(', ')}`;
  }
  getLogger().debug(debugMsg);

  if (botName === '*') {
    // Get all Agent top level metadata
    if (connection && Number(connection.getApiVersion()) > 63.0) {
      return Promise.resolve(v64topLevelMd);
    }
    return Promise.resolve(v63topLevelMd);
  }

  if (connection) {
    return resolveAgentFromConnection(connection, botName);
  } else {
    if (!directoryPaths || directoryPaths?.length === 0) {
      throw SfError.create({
        message: 'Cannot resolve Agent pseudo type from local files without a source directory',
      });
    }
    const registry = agentMdInfo.registry ?? new RegistryAccess();
    return resolveAgentFromLocalMetadata(botName, directoryPaths, registry);
  }
}

// Queries the org for metadata related to the provided Bot API name and returns those
// metadata type:name pairs.
const resolveAgentFromConnection = async (connection: Connection, botName: string): Promise<string[]> => {
  const mdEntries = [`Bot:${botName}`];
  // Query the org for agent metadata related to the Bot API name.
  try {
    // Query for the GenAiPlannerId
    const genAiPlannerIdQuery = `SELECT Id FROM GenAiPlannerDefinition WHERE DeveloperName = '${botName}'`;
    const plannerId = (await connection.singleRecordQuery<{ Id: string }>(genAiPlannerIdQuery, { tooling: true })).Id;

    if (plannerId) {
      const plannerType = Number(connection.getApiVersion()) > 63.0 ? 'GenAiPlannerBundle' : 'GenAiPlanner';
      mdEntries.push(`${plannerType}:${botName}`);
      // Query the junction table to get all GenAiPlugins associated with this GenAiPlannerId
      const topicIdsByPlanner = (
        await connection.tooling.query<{ Plugin: string }>(
          `SELECT Plugin FROM GenAiPlannerFunctionDef WHERE PlannerId = '${plannerId}'`
        )
      ).records;
      if (topicIdsByPlanner.length) {
        // Query the GenAiPluginDefinition table to get the DeveloperName for each GenAiPluginId
        const genAiPluginIds = `'${topicIdsByPlanner
          .map((record) => record.Plugin)
          .filter((pluginId) => validateSalesforceId(pluginId))
          .join("','")}'`;
        // This query returns customized plugins only
        const genAiPluginNames = (
          await connection.tooling.query<{ DeveloperName: string }>(
            `SELECT DeveloperName FROM GenAiPluginDefinition WHERE Id IN (${genAiPluginIds})`
          )
        ).records;
        if (genAiPluginNames.length) {
          genAiPluginNames.map((r) => mdEntries.push(`GenAiPlugin:${r.DeveloperName}`));
        } else {
          getLogger().debug(
            `No GenAiPlugin metadata matches for plannerId: ${plannerId}. Reading the ${plannerType} metadata for plugins...`
          );
          await getPluginNamesFromPlanner(connection, botName, mdEntries);
        }
      } else {
        getLogger().debug(
          `No GenAiPlugin metadata matches for plannerId: ${plannerId}. Reading the ${plannerType} metadata for plugins...`
        );
        await getPluginNamesFromPlanner(connection, botName, mdEntries);
      }
    } else {
      getLogger().debug(`No GenAiPlanner metadata matches for Bot: ${botName}`);
    }
  } catch (err) {
    const wrappedErr = SfError.wrap(err);
    getLogger().debug(
      `Error when querying for GenAiPlanner or GenAiPlugin by Bot name: ${botName}\n${wrappedErr.message}`
    );
    if (wrappedErr.stack) {
      getLogger().debug(wrappedErr.stack);
    }
  }
  return mdEntries;
};

// Finds and reads local metadata files related to the provided Bot API name and
// returns those metadata type:name pairs.
const resolveAgentFromLocalMetadata = (
  botName: string,
  directoryPaths: string[],
  registry: RegistryAccess
): string[] => {
  const mdEntries = new Set([`Bot:${botName}`]);
  // Inspect local files for agent metadata related to the Bot API name
  const botType = registry.getTypeByName('Bot');
  const botCompSet = ComponentSet.fromSource({
    fsPaths: directoryPaths,
    include: new ComponentSet([{ type: botType, fullName: botName }], registry),
    registry,
  });
  if (botCompSet.size < 1) {
    getLogger().debug(`Cannot resolve botName: ${botName} to a local file`);
  }
  const parser = new XMLParser({ ignoreAttributes: false });
  const botFiles = botCompSet.getComponentFilenamesByNameAndType({ type: 'Bot', fullName: botName });
  let plannerType = registry.getTypeByName('GenAiPlannerBundle');
  let plannerTypeName = 'GenAiPlannerBundle';
  let plannerCompSet = ComponentSet.fromSource({
    fsPaths: directoryPaths,
    include: new ComponentSet([{ type: plannerType, fullName: botName }], registry),
    registry,
  });
  // If the plannerCompSet is empty it might be due to the GenAiPlannerBundle having a
  // different name than the Bot. We need to search the BotVersion for the
  // planner API name.
  if (plannerCompSet.size < 1) {
    const botVersionFile = botFiles.find((botFile) => botFile.endsWith('.botVersion-meta.xml'));
    if (botVersionFile) {
      getLogger().debug(`Reading and parsing ${botVersionFile} to find all GenAiPlanner/GenAiPlannerBundle references`);
      const botVersionJson = xmlToJson<BotVersionExt>(botVersionFile, parser);
      // Per the schema, there can be multiple GenAiPlanners linked to a BotVersion
      // but I'm not sure how that would work so for now just using the first one.
      const planners = ensureArray(botVersionJson.BotVersion.conversationDefinitionPlanners);
      const genAiPlannerName = planners.length ? planners[0]?.genAiPlannerName : undefined;
      if (genAiPlannerName) {
        plannerCompSet = ComponentSet.fromSource({
          fsPaths: directoryPaths,
          include: new ComponentSet([{ type: plannerType, fullName: genAiPlannerName }], registry),
          registry,
        });
        // If the plannerCompSet is empty look for a GenAiPlanner
        if (plannerCompSet.size < 1) {
          plannerTypeName = 'GenAiPlanner';
          plannerType = registry.getTypeByName('GenAiPlanner');
          plannerCompSet = ComponentSet.fromSource({
            fsPaths: directoryPaths,
            include: new ComponentSet([{ type: plannerType, fullName: genAiPlannerName }], registry),
            registry,
          });
          if (plannerCompSet.size < 1) {
            getLogger().debug(`Cannot find GenAiPlanner or GenAiPlannerBundle with name: ${genAiPlannerName}`);
          }
        }
        getLogger().debug(`Adding ${plannerTypeName}:${genAiPlannerName}`);
        mdEntries.add(`${plannerTypeName}:${genAiPlannerName}`);
      } else {
        getLogger().debug(`Cannot find GenAiPlannerName in BotVersion file: ${botVersionFile}`);
      }
    }
  } else {
    getLogger().debug(`Adding ${plannerTypeName}:${botName}`);
    mdEntries.add(`${plannerTypeName}:${botName}`);
  }

  // Read the GenAiPlanner or GenAiPlannerBundle file for GenAiPlugins
  const plannerComp = plannerCompSet.getSourceComponents().first();
  if (plannerComp) {
    let plannerFilePath;
    if (plannerTypeName === 'GenAiPlannerBundle' && plannerComp.content) {
      const plannerFileName = plannerComp.tree
        .readDirectory(plannerComp.content)
        .find((p) => p.endsWith('.genAiPlannerBundle'));
      if (plannerFileName) {
        plannerFilePath = join(plannerComp.content, plannerFileName);
      } else {
        getLogger().debug(`Cannot find GenAiPlannerBundle file in ${plannerComp.content}`);
      }
    } else {
      plannerFilePath = plannerComp.xml;
    }

    // Certain internal plugins and functions cannot be retrieved/deployed so don't include them.
    const internalPrefixes = ['EmployeeCopilot__', 'SvcCopilotTmpl__'];
    if (plannerFilePath) {
      getLogger().debug(`Reading and parsing ${plannerFilePath} to find all GenAiPlugin references`);
      const plannerJson = xmlToJson<GenAiPlannerExt>(plannerFilePath, parser);

      // Add plugins defined in the planner
      // @ts-expect-error temporary until GenAiPlannerBundle metadata type is defined
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const genAiPlugins = ensureArray(plannerJson[plannerTypeName].genAiPlugins) as GenAiPlannerFunctionDef[];
      const pluginType = registry.getTypeByName('GenAiPlugin');
      const genAiPluginComps: MetadataComponent[] = [];
      genAiPlugins?.map((plugin) => {
        if (plugin.genAiPluginName && !internalPrefixes.some((prefix) => plugin.genAiPluginName?.startsWith(prefix))) {
          genAiPluginComps.push({ type: pluginType, fullName: plugin.genAiPluginName });
          getLogger().debug(`Adding GenAiPlugin:${plugin.genAiPluginName}`);
          mdEntries.add(`GenAiPlugin:${plugin.genAiPluginName}`);
        }
      });

      // Add functions defined in the plugins
      if (genAiPluginComps.length) {
        const pluginCompSet = ComponentSet.fromSource({
          fsPaths: directoryPaths,
          include: new ComponentSet(genAiPluginComps, registry),
          registry,
        });
        if (pluginCompSet.size > 1) {
          // For all plugin files, read and parse, adding all functions.
          for (const comp of pluginCompSet.getSourceComponents()) {
            if (comp.xml) {
              getLogger().debug(`Reading and parsing ${comp.xml} to find all GenAiFunction references`);
              const genAiPlugin = xmlToJson<GenAiPluginExt>(comp.xml, parser);
              const genAiFunctions = ensureArray(genAiPlugin.GenAiPlugin.genAiFunctions);
              genAiFunctions.map((func) => {
                if (func.functionName && !internalPrefixes.some((prefix) => func.functionName.startsWith(prefix))) {
                  getLogger().debug(`Adding GenAiFunction:${func.functionName}`);
                  mdEntries.add(`GenAiFunction:${func.functionName}`);
                }
              });
            }
          }
        }
      }
    }
  }
  return Array.from(mdEntries);
};

// Read an xml file, parse it to json and return the JSON.
const xmlToJson = <T>(path: string, parser: XMLParser): T => {
  const file = readFileSync(path, 'utf8');
  if (!file) throw new SfError(`No metadata file found at ${path}`);
  return parser.parse(file) as T;
};

// read the GenAiPlanner or GenAiPlannerBundle metadata from the org and add the GenAiPlugin names to the mdEntries array
const getPluginNamesFromPlanner = async (
  connection: Connection,
  botName: string,
  mdEntries: string[]
): Promise<void> => {
  const plannerType = Number(connection.getApiVersion()) > 63.0 ? 'GenAiPlannerBundle' : 'GenAiPlanner';
  // @ts-expect-error jsForce types don't know about GenAiPlanner yet
  const genAiPlannerMd = await connection.metadata.read<GenAiPlanner>(plannerType, botName);

  const genAiPlannerMdArr = ensureArray(genAiPlannerMd) as unknown as GenAiPlanner[];
  if (genAiPlannerMdArr?.length && genAiPlannerMdArr[0]?.genAiPlugins.length) {
    genAiPlannerMdArr[0].genAiPlugins.map((plugin) => {
      if (plugin.genAiPluginName?.length) {
        mdEntries.push(`GenAiPlugin:${plugin.genAiPluginName}`);
      }
    });
  } else {
    getLogger().debug(`No GenAiPlugin metadata found in planner file for API name: ${botName}`);
  }
};
