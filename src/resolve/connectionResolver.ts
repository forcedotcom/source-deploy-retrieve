/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection, Logger, Messages, Lifecycle, SfError } from '@salesforce/core';
import { ensurePlainObject, ensureString, isPlainObject } from '@salesforce/ts-types';
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

/**
 * Resolve MetadataComponents from an org connection
 */
export class ConnectionResolver {
  private readonly connection: Connection;
  private readonly registry: RegistryAccess;

  // Array of metadata type names to use for listMembers. By default it includes
  // all types defined in the registry.
  private mdTypeNames: string[];

  public constructor(connection: Connection, registry = new RegistryAccess(), mdTypes?: string[]) {
    this.connection = connection;
    this.registry = registry;
    this.mdTypeNames = mdTypes?.length
      ? // ensure the types passed in are valid per the registry
        mdTypes.filter((t) => this.registry.getTypeByName(t))
      : Object.values(this.registry.getRegistry().types).map((t) => t.name);
  }

  public async resolve(
    componentFilter = (component: Partial<FileProperties>): boolean => isPlainObject(component)
  ): Promise<ResolveConnectionResult> {
    const Aggregator: Array<Partial<FileProperties>> = [];
    const childrenPromises: Array<Promise<RelevantFileProperties[]>> = [];
    const componentTypes: Set<MetadataType> = new Set();
    const lifecycle = Lifecycle.getInstance();

    const componentFromDescribe = (
      await Promise.all(this.mdTypeNames.map((type) => listMembers(this.registry)(this.connection)({ type })))
    ).flat();

    for (const component of componentFromDescribe) {
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

      Aggregator.push(component);
      componentTypes.add(componentType);
      if (componentType.folderContentType) {
        childrenPromises.push(
          listMembers(this.registry)(this.connection)({
            type: this.registry.getTypeByName(componentType.folderContentType).name,
            folder: component.fullName,
          })
        );
      }
    }

    for (const componentType of componentTypes) {
      const childTypes = componentType.children?.types;
      if (childTypes) {
        Object.values(childTypes).map((childType) => {
          childrenPromises.push(listMembers(this.registry)(this.connection)({ type: childType.name }));
        });
      }
    }

    for await (const childrenResult of childrenPromises) {
      Aggregator.push(...childrenResult);
    }

    return {
      components: Aggregator.filter(componentFilter).map((component) => ({
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
}

const listMembers =
  (registry: RegistryAccess) =>
  (connection: Connection) =>
  async (query: ListMetadataQuery): Promise<RelevantFileProperties[]> => {
    const mdType = registry.getTypeByName(query.type);

    // Workaround because metadata.list({ type: 'StandardValueSet' }) returns []
    if (mdType.name === registry.getRegistry().types.standardvalueset.name) {
      const members: RelevantFileProperties[] = [];

      const standardValueSetPromises = standardValueSet.fullnames.map(async (standardValueSetFullName) => {
        try {
          const standardValueSetRecord: StdValueSetRecord = await connection.singleRecordQuery(
            `SELECT Id, MasterLabel, Metadata FROM StandardValueSet WHERE MasterLabel = '${standardValueSetFullName}'`,
            { tooling: true }
          );

          return (
            standardValueSetRecord.Metadata.standardValue.length && {
              fullName: standardValueSetRecord.MasterLabel,
              fileName: `${mdType.directoryName}/${standardValueSetRecord.MasterLabel}.${mdType.suffix ?? ''}`,
              type: mdType.name,
            }
          );
        } catch (err) {
          const logger = Logger.childFromRoot('ConnectionResolver.listMembers');
          logger.debug(err);
        }
      });
      for await (const standardValueSetResult of standardValueSetPromises) {
        if (standardValueSetResult) {
          members.push(standardValueSetResult);
        }
      }
      return members;
    }

    try {
      return (await connection.metadata.list(query)).map(inferFilenamesFromType(mdType));
    } catch (error) {
      const logger = Logger.childFromRoot('ConnectionResolver.listMembers');
      logger.debug((error as Error).message);
      return [];
    }
  };

/* if the Metadata Type doesn't return a correct fileName then help it out */
const inferFilenamesFromType =
  (metadataType: MetadataType) =>
  (member: RelevantFileProperties): RelevantFileProperties =>
    typeof member.fileName === 'object' && metadataType.suffix
      ? { ...member, fileName: `${metadataType.directoryName}/${member.fullName}.${metadataType.suffix}` }
      : member;

const isNonEmptyString = (value: string | undefined): boolean => typeof value === 'string' && value.length > 0;
