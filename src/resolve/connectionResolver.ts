/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { retry, NotRetryableError, RetryError } from 'ts-retry-promise';
import { PollingClient, StatusResult, Connection, Logger, Messages, Lifecycle, SfError } from '@salesforce/core';
import { Duration, ensureArray } from '@salesforce/kit';
import { ensurePlainObject, ensureString, isPlainObject } from '@salesforce/ts-types';
import { RegistryAccess } from '../registry/registryAccess';
import { registry as defaultRegistry } from '../registry/registry';
import { MetadataType } from '../registry/types';
import { standardValueSet } from '../registry/standardvalueset';
import { FileProperties, StdValueSetRecord, ListMetadataQuery } from '../client/types';
import { extName } from '../utils/path';
import { MetadataComponent } from './types';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

export interface ResolveConnectionResult {
  components: MetadataComponent[];
  apiVersion: string;
}

/**
 * Resolve MetadataComponents from an org connection
 */
export class ConnectionResolver {
  protected logger: Logger;
  private connection: Connection;
  private registry: RegistryAccess;

  // Array of metadata type names to use for listMembers. By default it includes
  // all types defined in the registry.
  private mdTypeNames: string[];

  public constructor(connection: Connection, registry = new RegistryAccess(), mdTypes?: string[]) {
    this.connection = connection;
    this.registry = registry;
    this.logger = Logger.childFromRoot(this.constructor.name);
    this.mdTypeNames = mdTypes?.length
      ? // ensure the types passed in are valid per the registry
        mdTypes.filter((t) => this.registry.getTypeByName(t))
      : Object.values(defaultRegistry.types).map((t) => t.name);
  }

  public async resolve(
    componentFilter = (component: Partial<FileProperties>): boolean => isPlainObject(component)
  ): Promise<ResolveConnectionResult> {
    const Aggregator: Array<Partial<FileProperties>> = [];
    const childrenPromises: Array<Promise<FileProperties[]>> = [];
    const componentTypes: Set<MetadataType> = new Set();
    const lifecycle = Lifecycle.getInstance();

    const componentFromDescribe = (
      await Promise.all(this.mdTypeNames.map((type) => this.listMembers({ type })))
    ).flat();

    for (const component of componentFromDescribe) {
      let componentType: MetadataType;
      if (typeof component.type === 'string' && component.type.length) {
        componentType = this.registry.getTypeByName(component.type);
      } else if (typeof component.fileName === 'string' && component.fileName.length) {
        // fix { type: { "$": { "xsi:nil": "true" } } }
        componentType = ensurePlainObject(
          this.registry.getTypeBySuffix(extName(component.fileName)),
          `No type found for ${component.fileName} when matching by suffix.  Check the file extension.`
        );
        component.type = componentType.name;
      } else if (component.type === undefined && component.fileName === undefined) {
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

      Aggregator.push(component);
      componentTypes.add(componentType);
      const folderContentType = componentType.folderContentType;
      if (folderContentType) {
        childrenPromises.push(
          this.listMembers({
            type: this.registry.getTypeByName(folderContentType).name,
            folder: component.fullName,
          })
        );
      }
    }

    for (const componentType of componentTypes) {
      const childTypes = componentType.children?.types;
      if (childTypes) {
        Object.values(childTypes).map((childType) => {
          childrenPromises.push(this.listMembers({ type: childType.name }));
        });
      }
    }

    for await (const childrenResult of childrenPromises) {
      Aggregator.push(...childrenResult);
    }

    return {
      components: Aggregator.filter(componentFilter).map((component) => ({
        fullName: ensureString(component.fullName, `Component fullName was not set for ${component.fileName}`),
        type: this.registry.getTypeByName(
          ensureString(component.type, `Component type was not set for ${component.fullName} (${component.fileName})`)
        ),
      })),
      apiVersion: this.connection.getApiVersion(),
    };
  }

  private async listMembers(query: ListMetadataQuery): Promise<FileProperties[]> {
    let members: FileProperties[];

    const pollingOptions: PollingClient.Options = {
      frequency: Duration.milliseconds(1000),
      timeout: Duration.minutes(3),
      poll: async (): Promise<StatusResult> => {
        const res = ensureArray(await this.connection.metadata.list(query));
        return { completed: true, payload: res };
      },
    };

    const pollingClient = await PollingClient.create(pollingOptions);

    try {
      members = await pollingClient.subscribe();
    } catch (error) {
      // throw error if PollingClient timed out.
      if (error instanceof NotRetryableError) {
        throw NotRetryableError;
      }
      this.logger.debug((error as Error).message);
      members = [];
    }

    // if the Metadata Type doesn't return a correct fileName then help it out
    for (const m of members) {
      if (typeof m.fileName == 'object') {
        const t = this.registry.getTypeByName(query.type);
        m.fileName = `${t.directoryName}/${m.fullName}.${t.suffix}`;
      }
    }

    // Workaround because metadata.list({ type: 'StandardValueSet' }) returns []
    if (query.type === defaultRegistry.types.standardvalueset.name && members.length === 0) {
      const standardValueSetPromises = standardValueSet.fullnames.map(async (standardValueSetFullName) => {
        try {
          // The 'singleRecordQuery' method was having connection errors, using `retry` resolves this
          // Note that this type of connection retry logic may someday be added to jsforce v2
          // Once that happens this logic could be reverted
          const standardValueSetRecord: StdValueSetRecord = await retry(async () => {
            try {
              return await this.connection.singleRecordQuery(
                `SELECT Id, MasterLabel, Metadata FROM StandardValueSet WHERE MasterLabel = '${standardValueSetFullName}'`,
                { tooling: true }
              );
            } catch (err) {
              // We exit the retry loop with `NotRetryableError` if we get an (expected) unsupported metadata type error
              const error = err as Error;
              if (error.message.includes('either inaccessible or not supported in Metadata API')) {
                this.logger.debug('Expected error:', error.message);
                throw new NotRetryableError(error.message);
              }

              // Otherwise throw the err so we can retry again
              throw err;
            }
          });

          return (
            standardValueSetRecord.Metadata.standardValue.length && {
              fullName: standardValueSetRecord.MasterLabel,
              fileName: `${defaultRegistry.types.standardvalueset.directoryName}/${standardValueSetRecord.MasterLabel}.${defaultRegistry.types.standardvalueset.suffix}`,
              type: defaultRegistry.types.standardvalueset.name,
              createdById: '',
              createdByName: '',
              createdDate: '',
              id: '',
              lastModifiedById: '',
              lastModifiedByName: '',
              lastModifiedDate: '',
            }
          );
        } catch (err) {
          // error.message here will be overwritten by 'ts-retry-promise'
          // Example error.message from the library: "All retries failed" or "Met not retryable error"
          // 'ts-retry-promise' exposes the actual error on `error.lastError`
          const error = err as RetryError;

          if (error.lastError?.message) {
            this.logger.debug(error.lastError.message);
          }
        }
      });
      for await (const standardValueSetResult of standardValueSetPromises) {
        if (standardValueSetResult) {
          members.push(standardValueSetResult);
        }
      }
    }

    return members;
  }
}
