/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RegistryAccess, registry, MetadataType } from '../registry';
import { standardValueSet } from '../registry/standardvalueset';
import { Connection, Logger } from '@salesforce/core';
import { FileProperties, QueryResult, StdValueSetRecord, ListMetadataQuery } from '../client/types';
import { normalizeToArray } from '../utils';
import { MetadataComponent } from './types';
export interface ResolveConnectionResult {
  components: MetadataComponent[];
}

/**
 * Resolve MetadataComponents from an org connection
 */
export class ConnectionResolver {
  protected logger: Logger;
  private connection: Connection;
  private registry: RegistryAccess;

  constructor(connection: Connection, registry = new RegistryAccess()) {
    this.connection = connection;
    this.registry = registry;
    this.logger = Logger.childFromRoot(this.constructor.name);
  }

  public async resolve(excludeManagedComponents = true): Promise<ResolveConnectionResult> {
    const Aggregator: Partial<FileProperties>[] = [];
    const childrenPromises: Array<Promise<FileProperties[]>> = [];
    const componentTypes: Set<MetadataType> = new Set();

    const componentPromises: Array<Promise<FileProperties[]>> = [];
    for (const type of Object.values(registry.types)) {
      componentPromises.push(this.listMembers({ type: type.name }));
    }
    for await (const componentResult of componentPromises) {
      Aggregator.push(...componentResult);
      for (const component of componentResult) {
        const componentType = this.registry.getTypeByName(component.type);
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

    const components = Aggregator.filter(
      (component) =>
        !(
          excludeManagedComponents &&
          component.namespacePrefix &&
          component.manageableState !== 'unmanaged'
        )
    )
      .map((component) => {
        return { fullName: component.fullName, type: this.registry.getTypeByName(component.type) };
      })
      .sort((a, b) => {
        if (a.type.name === b.type.name) {
          return a.fullName.toLowerCase() > b.fullName.toLowerCase() ? 1 : -1;
        }
        return a.type.name.toLowerCase() > b.type.name.toLowerCase() ? 1 : -1;
      });

    return {
      components,
    };
  }

  private async listMembers(
    query: ListMetadataQuery,
    apiVersion?: string
  ): Promise<FileProperties[]> {
    let members: FileProperties[];

    try {
      members = normalizeToArray(
        (await this.connection.metadata.list(query, apiVersion)) as FileProperties[]
      );
    } catch (error) {
      this.logger.error(error.message);
      members = [];
    }

    // Workaround because metadata.list({ type: 'StandardValueSet' }) returns []
    if (query.type === registry.types.standardvalueset.name && members.length === 0) {
      const standardValueSetPromises = standardValueSet.fullNames.map(
        async (standardValueSetFullName) => {
          try {
            const queryResult = (await this.connection.tooling.query(
              `SELECT Id, MasterLabel, Metadata FROM StandardValueSet WHERE MasterLabel = '${standardValueSetFullName}'`
            )) as QueryResult;
            const standardValueSetRecord = queryResult.records[0] as StdValueSetRecord;
            return (
              standardValueSetRecord.Metadata.standardValue.length && {
                fullName: standardValueSetRecord.MasterLabel,
                fileName: `${registry.types.standardvalueset.directoryName}/${standardValueSetRecord.MasterLabel}.${registry.types.standardvalueset.suffix}`,
                type: registry.types.standardvalueset.name,
                createdById: '',
                createdByName: '',
                createdDate: '',
                id: '',
                lastModifiedById: '',
                lastModifiedByName: '',
                lastModifiedDate: '',
              }
            );
          } catch (error) {
            this.logger.debug((error as Error).message);
          }
        }
      );
      for await (const standardValueSetResult of standardValueSetPromises) {
        if (standardValueSetResult) {
          members.push(standardValueSetResult);
        }
      }
    }

    return members;
  }
}
