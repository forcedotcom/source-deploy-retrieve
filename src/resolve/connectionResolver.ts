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

import { inspect } from 'node:util';
import { Connection, Logger, Messages, Lifecycle, SfError } from '@salesforce/core';
import { ensurePlainObject, ensureString, isPlainObject } from '@salesforce/ts-types';
import { env } from '@salesforce/kit';
import { RegistryAccess } from '../registry/registryAccess';
import { MetadataType } from '../registry/types';
import { standardValueSet } from '../registry/standardvalueset';
import { FileProperties, StdValueSetRecord, ListMetadataQuery } from '../client/types';
import { extName } from '../utils/path';
import { MetadataComponent } from './types';

type RelevantFileProperties = Pick<FileProperties, 'fullName' | 'fileName' | 'type'>;

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

export type ResolveConnectionResult = {
  components: MetadataComponent[];
  apiVersion: string;
};

let requestCount = 0;
let shouldQueryStandardValueSets = false;

let logger: Logger;
const getLogger = (): Logger => {
  if (!logger) {
    logger = Logger.childFromRoot('ConnectionResolver');
  }
  return logger;
};

// ***  ***  ***  ***  ***  ***  ***  ***  ***  ***  ***  ***  ***  ***  ***  ***  ***
//
// NOTE: The `listMetadata` API supports passing 3 metadata types per call but we
//       can't do this because if 1 of the 3 types is not supported by the org (or
//       errors in some way) we don't get any data back about the other types. This
//       means we are forced to make listMetadata calls for individual metadata types.
//
// ***  ***  ***  ***  ***  ***  ***  ***  ***  ***  ***  ***  ***  ***  ***  ***  ***

/**
 * Resolve MetadataComponents from an org connection by making listMetadata API calls
 * for the specified metadata types (`mdTypes` arg) or all supported metadata types
 * in the registry.
 */
export class ConnectionResolver {
  private connection: Connection;
  private registry: RegistryAccess;

  // Array of metadata type names to use for listMembers. By default it includes
  // all types defined in the registry.
  private mdTypeNames: string[];

  private requestBatchSize: number;

  public constructor(connection: Connection, registry = new RegistryAccess(), mdTypes?: string[]) {
    this.connection = connection;
    this.registry = registry;
    this.mdTypeNames = mdTypes?.length
      ? // ensure the types passed in are valid per the registry
        mdTypes.filter((t) => this.registry.getTypeByName(t))
      : Object.values(this.registry.getRegistry().types).map((t) => t.name);

    // Always reset this. listMembers() function detects and sets it.
    shouldQueryStandardValueSets = false;

    // To limit the number of concurrent requests, batch them per an env var.
    // Default is 500. From testing we saw jsforce gets stuck on ~1K reqs.
    this.requestBatchSize = env.getNumber('SF_LIST_METADATA_BATCH_SIZE', 500);
  }

  public async resolve(
    componentFilter = (component: Partial<FileProperties>): boolean => isPlainObject(component)
  ): Promise<ResolveConnectionResult> {
    // Aggregate array of metadata records in the org
    let aggregator: Array<Partial<FileProperties>> = [];
    // Folder component type names. Each array value has the form [type::folder]
    const folderComponentTypes: string[] = [];
    // Child component type names
    const childComponentTypes: Set<string> = new Set();

    const lifecycle = Lifecycle.getInstance();

    // Make batched listMetadata requests for top level metadata
    const listMetadataResponses = await this.sendBatchedRequests(this.mdTypeNames);

    for (const component of listMetadataResponses) {
      let componentType: MetadataType;
      if (isNonEmptyString(component.type)) {
        componentType = this.registry.getTypeByName(component.type);
      } else if (isNonEmptyString(component.fileName)) {
        // fix { type: { "$": { "xsi:nil": "true" } } }
        componentType = ensurePlainObject(
          this.registry.getTypeBySuffix(extName(component.fileName)),
          `No type found for ${component.fileName} when matching by suffix.  Check the file extension.`
        );
        component.type = componentType.name;
      } else if (!isNonEmptyString(component.type) && !isNonEmptyString(component.fileName)) {
        // has no type and has no filename!  Warn and skip that component.
        // eslint-disable-next-line no-await-in-loop
        await Promise.all([
          lifecycle.emitWarning(messages.getMessage('error_could_not_infer_type', [component.fullName])),
          lifecycle.emitTelemetry({ TypeInferenceError: component, from: 'ConnectionResolver' }),
        ]);
        continue;
      } else {
        // it DOES have all the important info but we couldn't resolve it.
        // has no type and has no filename!
        throw new SfError(
          messages.getMessage('error_could_not_infer_type', [component.fullName]),
          'TypeInferenceError',
          [messages.getMessage('suggest_type_more_suggestions')]
        );
      }

      aggregator.push(component);
      if (componentType.folderContentType) {
        const type = this.registry.getTypeByName(componentType.folderContentType).name;
        const folder = component.fullName;
        folderComponentTypes.push(`${type}::${folder}`);
      }

      const childTypes = componentType.children?.types;
      if (childTypes) {
        Object.values(childTypes).map((childType) => childComponentTypes.add(childType.name));
      }
    }

    if (folderComponentTypes.length) {
      const folderFileProps = await this.sendBatchedRequests(folderComponentTypes);
      aggregator = aggregator.concat(folderFileProps);
    }

    if (childComponentTypes.size > 0) {
      const childComponentFileProps = await this.sendBatchedRequests(Array.from(childComponentTypes));
      aggregator = aggregator.concat(childComponentFileProps);
    }

    // If we need to query the list of StandardValueSets (i.e., it's included in this.mdTypeNames)
    // make those requests now.
    if (shouldQueryStandardValueSets) {
      const svsFileProps = await this.sendBatchedQueries();
      aggregator = aggregator.concat(svsFileProps);
    }

    getLogger().debug(`https request count = ${requestCount}`);

    return {
      components: aggregator.filter(componentFilter).map((component) => ({
        fullName: ensureString(
          component.fullName,
          `Component fullName was not set for ${component.fileName ?? '<missing filename>'}`
        ),
        type: this.registry.getTypeByName(
          ensureString(
            component.type,
            `Component type was not set for ${component.fullName ?? '<missing fullname>'} (${
              component.fileName ?? '<missing filename>'
            })`
          )
        ),
      })),
      apiVersion: this.connection.getApiVersion(),
    };
  }

  // Send batched listMetadata requests based on the SF_LIST_METADATA_BATCH_SIZE env var.
  private async sendBatchedRequests(listMdQueries: string[]): Promise<RelevantFileProperties[]> {
    let listMetadataResponses: RelevantFileProperties[] = [];
    let listMetadataRequests: Array<Promise<RelevantFileProperties[]>> = [];

    const sendIt = async (): Promise<void> => {
      const requestBatch = (await Promise.all(listMetadataRequests)).flat();
      listMetadataResponses = listMetadataResponses.concat(requestBatch);
    };

    // Make batched listMetadata requests
    for (let i = 0; i < listMdQueries.length; ) {
      const q = listMdQueries[i].split('::');
      const listMdQuery = { type: q[0] } as ListMetadataQuery;
      if (q[1]) {
        listMdQuery.folder = q[1];
      }
      listMetadataRequests.push(listMembers(this.registry, this.connection, listMdQuery));
      i++;
      if (this.requestBatchSize > 0 && i % this.requestBatchSize === 0) {
        getLogger().debug(`Awaiting listMetadata requests ${i - this.requestBatchSize + 1} - ${i}`);
        // We are deliberately awaiting the results of batches to throttle requests.
        // eslint-disable-next-line no-await-in-loop
        await sendIt();
        // Reset the requests for the next batch
        listMetadataRequests = [];
      }

      // Always flush the last batch; or send non-batched requests
      if (i === listMdQueries.length) {
        getLogger().debug('Awaiting listMetadata requests');
        // We are deliberately awaiting the results of batches to throttle requests.
        // eslint-disable-next-line no-await-in-loop
        await sendIt();
      }
    }
    return listMetadataResponses;
  }

  // Send batched queries for a known subset of StandardValueSets based on the
  // SF_LIST_METADATA_BATCH_SIZE env var.
  private async sendBatchedQueries(): Promise<RelevantFileProperties[]> {
    const mdType = this.registry.getTypeByName('StandardValueSet');
    let queryResponses: RelevantFileProperties[] = [];
    let queryRequests: Array<Promise<RelevantFileProperties | undefined>> = [];

    const sendIt = async (): Promise<void> => {
      const requestBatch = (await Promise.all(queryRequests)).flat();
      queryResponses = queryResponses.concat(requestBatch.filter((rb) => !!rb));
    };

    // Make batched query requests
    const svsNames = standardValueSet.fullnames;
    for (let i = 0; i < svsNames.length; ) {
      const svsFullName = svsNames[i];
      queryRequests.push(querySvs(this.connection)(svsFullName, mdType));
      i++;
      if (this.requestBatchSize > 0 && i % this.requestBatchSize === 0) {
        getLogger().debug(`Awaiting StandardValueSet queries ${i - this.requestBatchSize + 1} - ${i}`);
        // We are deliberately awaiting the results of batches to throttle requests.
        // eslint-disable-next-line no-await-in-loop
        await sendIt();
        // Reset the requests for the next batch
        queryRequests = [];
      }

      // Always flush the last batch; or send non-batched requests
      if (i === svsNames.length) {
        getLogger().debug('Awaiting StandardValueSet queries');
        // We are deliberately awaiting the results of batches to throttle requests.
        // eslint-disable-next-line no-await-in-loop
        await sendIt();
      }
    }
    return queryResponses;
  }
}

const querySvs =
  (connection: Connection) =>
  async (svsFullName: string, svsType: MetadataType): Promise<RelevantFileProperties | undefined> => {
    try {
      requestCount++;
      getLogger().debug(`StandardValueSet query for ${svsFullName}`);
      const standardValueSetRecord: StdValueSetRecord = await connection.singleRecordQuery(
        `SELECT Id, MasterLabel, Metadata FROM StandardValueSet WHERE MasterLabel = '${svsFullName}'`,
        { tooling: true }
      );
      if (standardValueSetRecord.Metadata.standardValue.length) {
        return {
          fullName: standardValueSetRecord.MasterLabel,
          fileName: `${svsType.directoryName}/${standardValueSetRecord.MasterLabel}.${svsType.suffix ?? ''}`,
          type: svsType.name,
        };
      }
    } catch (error) {
      const err = SfError.wrap(error);
      getLogger().debug(`[${svsFullName}] ${err.message}`);
    }
  };

async function listMembers(
  registry: RegistryAccess,
  connection: Connection,
  query: ListMetadataQuery
): Promise<RelevantFileProperties[]> {
  const mdType = registry.getTypeByName(query.type);

  // Workaround because metadata.list({ type: 'StandardValueSet' }) returns [].
  // Query for a subset of known StandardValueSets after all listMetadata calls.
  if (mdType.name === registry.getRegistry().types.standardvalueset.name) {
    shouldQueryStandardValueSets = true;
    return [];
  }

  // Workaround because metadata.list({ type: 'BotVersion' }) returns [].
  if (mdType.name === 'BotVersion') {
    try {
      const botDefQuery = 'SELECT Id, DeveloperName FROM BotDefinition';
      const botVersionQuery = 'SELECT BotDefinitionId, DeveloperName FROM BotVersion';
      const botDefs = (await connection.query<{ Id: string; DeveloperName: string }>(botDefQuery)).records;
      const botVersionDefs = (
        await connection.query<{ BotDefinitionId: string; DeveloperName: string }>(botVersionQuery)
      ).records;
      return botVersionDefs
        .map((bvd) => {
          const botName = botDefs.find((bd) => bd.Id === bvd.BotDefinitionId)?.DeveloperName;
          if (botName) {
            return {
              fullName: `${botName}.${bvd.DeveloperName}`,
              fileName: `bots/${bvd.DeveloperName}.botVersion`,
              type: 'BotVersion',
            };
          }
        })
        .filter((b) => !!b);
    } catch (error) {
      const err = SfError.wrap(error);
      getLogger().debug(`[${mdType.name}] ${err.message}`);
      return [];
    }
  }

  try {
    requestCount++;
    getLogger().debug(`listMetadata for ${inspect(query)}`);
    return (await connection.metadata.list(query)).map(inferFilenamesFromType(mdType));
  } catch (error) {
    const err = SfError.wrap(error);
    getLogger().debug(`[${mdType.name}] ${err.message}`);
    return [];
  }
}

/* if the Metadata Type doesn't return a correct fileName then help it out */
const inferFilenamesFromType =
  (metadataType: MetadataType) =>
  (member: RelevantFileProperties): RelevantFileProperties =>
    typeof member.fileName === 'object' && metadataType.suffix
      ? { ...member, fileName: `${metadataType.directoryName}/${member.fullName}.${metadataType.suffix}` }
      : member;

const isNonEmptyString = (value: string | undefined): boolean => typeof value === 'string' && value.length > 0;
