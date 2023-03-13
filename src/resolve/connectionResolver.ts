/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection, Logger } from '@salesforce/core';
import { ensureArray } from '@salesforce/kit';
import { retry, NotRetryableError, RetryError } from 'ts-retry-promise';
import { ensurePlainObject, ensureString, isPlainObject } from '@salesforce/ts-types';
import { RegistryAccess, registry as defaultRegistry, MetadataType } from '../registry';
import { standardValueSet } from '../registry/standardvalueset';
import { FileProperties, StdValueSetRecord, ListMetadataQuery } from '../client/types';
import { extName } from '../utils';
import { MetadataComponent } from './types';
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

  public constructor(connection: Connection, registry = new RegistryAccess()) {
    this.connection = connection;
    this.registry = registry;
    this.logger = Logger.childFromRoot(this.constructor.name);
  }

  public async resolve(
    componentFilter = (component: Partial<FileProperties>): boolean => isPlainObject(component)
  ): Promise<ResolveConnectionResult> {
    const Aggregator: Array<Partial<FileProperties>> = [];
    const childrenPromises: Array<Promise<FileProperties[]>> = [];
    const componentTypes: Set<MetadataType> = new Set();

    const componentPromises: Array<Promise<FileProperties[]>> = [];
    for (const type of Object.values(defaultRegistry.types)) {
      componentPromises.push(this.listMembers({ type: type.name }));
    }
    (await Promise.all(componentPromises)).map((componentResult) => {
      for (const component of componentResult) {
        let componentType: MetadataType;
        if (typeof component.type === 'string' && component.type.length) {
          componentType = this.registry.getTypeByName(component.type);
        } else {
          // fix { type: { "$": { "xsi:nil": "true" } } }
          componentType = ensurePlainObject(
            this.registry.getTypeBySuffix(extName(component.fileName)),
            `No type found for ${component.fileName} when matching by suffix.  Check the file extension.`
          );
          component.type = componentType.name;
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
    });

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

    try {
      members = ensureArray((await this.connection.metadata.list(query)) as FileProperties[]);
    } catch (error) {
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
