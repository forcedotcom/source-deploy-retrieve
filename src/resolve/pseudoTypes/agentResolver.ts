/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { readFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import { Connection, Logger, SfError, trimTo15 } from '@salesforce/core';
import type { BotVersion, GenAiPlanner, GenAiPlugin } from '@salesforce/types/metadata';
import { ensureArray } from '@salesforce/kit';
import { RegistryAccess } from '../../registry';
import { ComponentSet } from '../../collections/componentSet';
import { SourceComponent } from '../sourceComponent';
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
    return Promise.resolve(['Bot', 'GenAiPlanner', 'GenAiPlugin', 'GenAiFunction']);
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
      mdEntries.push(`GenAiPlanner:${botName}`);
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
        getLogger().debug(
          `No GenAiPlugin metadata matches for plannerId: ${plannerId15}. Reading the planner metadata for plugins...`
        );
        // read the planner metadata from the org
        // @ts-expect-error jsForce types don't know about GenAiPlanner yet
        const genAiPlannerMd = ensureArray(
          await connection.metadata.read<GenAiPlanner>('GenAiPlanner', botName)
        ) as GenAiPlanner[];
        if (genAiPlannerMd?.length && genAiPlannerMd[0]?.genAiPlugins.length) {
          genAiPlannerMd[0].genAiPlugins.map((plugin) => {
            if (plugin.genAiPluginName?.length) {
              mdEntries.push(`GenAiPlugin:${plugin.genAiPluginName}`);
            }
          });
        } else {
          getLogger().debug(`No GenAiPlugin metadata found in planner file for API name: ${botName}`);
        }
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
  const plannerType = registry.getTypeByName('GenAiPlanner');
  let plannerCompSet = ComponentSet.fromSource({
    fsPaths: directoryPaths,
    include: new ComponentSet([{ type: plannerType, fullName: botName }], registry),
    registry,
  });
  // If the plannerCompSet is empty it might be due to the GenAiPlanner having a
  // different name than the Bot. We need to search the BotVersion for the
  // planner API name.
  if (plannerCompSet.size < 1) {
    const botVersionFile = botFiles.find((botFile) => botFile.endsWith('.botVersion-meta.xml'));
    if (botVersionFile) {
      getLogger().debug(`Reading and parsing ${botVersionFile} to find all GenAiPlanner references`);
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
        if (plannerCompSet.size < 1) {
          getLogger().debug(`Cannot find GenAiPlanner with name: ${genAiPlannerName}`);
        }
        getLogger().debug(`Adding GenAiPlanner:${genAiPlannerName}`);
        mdEntries.add(`GenAiPlanner:${genAiPlannerName}`);
      } else {
        getLogger().debug(`Cannot find GenAiPlannerName in BotVersion file: ${botVersionFile}`);
      }
    }
  } else {
    getLogger().debug(`Adding GenAiPlanner:${botName}`);
    mdEntries.add(`GenAiPlanner:${botName}`);
  }

  // Read the GenAiPlanner file for GenAiPlugins
  const plannerComp = plannerCompSet.find((mdComp) => mdComp.type.name === 'GenAiPlanner');
  if (plannerComp && 'xml' in plannerComp) {
    const plannerFile = (plannerComp as SourceComponent).xml;
    // Certain internal plugins and functions cannot be retrieved/deployed so don't include them.
    const internalPrefix = 'EmployeeCopilot__';
    if (plannerFile) {
      getLogger().debug(`Reading and parsing ${plannerFile} to find all GenAiPlugin references`);
      const plannerJson = xmlToJson<GenAiPlannerExt>(plannerFile, parser);

      // Add plugins defined in the planner
      const genAiPlugins = ensureArray(plannerJson.GenAiPlanner.genAiPlugins);
      const pluginType = registry.getTypeByName('GenAiPlugin');
      const genAiPluginComps: MetadataComponent[] = [];
      genAiPlugins?.map((plugin) => {
        if (plugin.genAiPluginName && !plugin.genAiPluginName.startsWith(internalPrefix)) {
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
                if (func.functionName && !func.functionName.startsWith(internalPrefix)) {
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
