/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SourceRetrieveResult } from '..';
import { ConvertOutputConfig, MetadataConverter, SourceComponent } from '../';
import { ComponentSet } from '../collections';
import { RegistryAccess, ZipTreeContainer } from '../metadata-registry';
import {
  RequestStatus,
  RetrieveFailure,
  RetrieveOptions,
  RetrieveResult,
  RetrieveSuccess,
} from './types';
import { MetadataTransfer, MetadataTransferOptions } from './metadataTransfer';

export type MetadataApiRetrieveOptions = MetadataTransferOptions &
  RetrieveOptions & { registry?: RegistryAccess };

export class MetadataApiRetrieve extends MetadataTransfer<RetrieveResult, SourceRetrieveResult> {
  public static DEFAULT_OPTIONS: Partial<MetadataApiRetrieveOptions> = { merge: false };
  private options: MetadataApiRetrieveOptions;

  constructor(options: MetadataApiRetrieveOptions) {
    super(options);
    this.options = Object.assign({}, MetadataApiRetrieve.DEFAULT_OPTIONS, options);
  }

  protected async pre(): Promise<{ id: string }> {
    const connection = await this.getConnection();
    // @ts-ignore required callback
    return connection.metadata.retrieve({
      apiVersion: this.components.apiVersion,
      unpackaged: this.components.getObject().Package,
    });
  }

  protected async checkStatus(id: string): Promise<RetrieveResult> {
    const connection = await this.getConnection();
    // Recasting to use the project's RetrieveResult type
    return (connection.metadata.checkRetrieveStatus(id) as unknown) as Promise<RetrieveResult>;
  }

  protected async post(result: RetrieveResult): Promise<SourceRetrieveResult> {
    let components: SourceComponent[] = [];
    if (result.status === RequestStatus.Succeeded) {
      components = await this.extract(Buffer.from(result.zipFile, 'base64'));
    }
    return this.buildSourceRetrieveResult(result, components);
  }

  protected async doCancel(): Promise<boolean> {
    // retrieve doesn't require signaling to the server to stop
    return true;
  }

  private async extract(zip: Buffer): Promise<SourceComponent[]> {
    const converter = new MetadataConverter(this.options.registry);
    const { merge, output } = this.options;
    const outputConfig: ConvertOutputConfig = merge
      ? {
          type: 'merge',
          mergeWith: this.components.getSourceComponents(),
          defaultDirectory: output,
        }
      : {
          type: 'directory',
          outputDirectory: output,
        };
    const zipComponents = ComponentSet.fromSource('.', {
      registry: this.options.registry,
      tree: await ZipTreeContainer.create(zip),
    }).getSourceComponents();

    const convertResult = await converter.convert(
      Array.from(zipComponents),
      'source',
      outputConfig
    );

    return convertResult.converted;
  }

  private buildSourceRetrieveResult(
    retrieveResult: RetrieveResult,
    retrievedComponents: SourceComponent[]
  ): SourceRetrieveResult {
    const retrievedSet = new ComponentSet(retrievedComponents, this.options.registry);
    const successes: RetrieveSuccess[] = [];
    const failures: RetrieveFailure[] = [];

    if (retrieveResult.messages) {
      const retrieveMessages = Array.isArray(retrieveResult.messages)
        ? retrieveResult.messages
        : [retrieveResult.messages];

      for (const message of retrieveMessages) {
        // match type name and fullname of problem component
        const matches = message.problem.match(/.+'(.+)'.+'(.+)'/);
        if (matches) {
          const [typeName, fullName] = matches.slice(1);
          failures.push({
            component: {
              fullName,
              type: this.options.registry.getTypeByName(typeName),
            },
            message: message.problem,
          });
        } else {
          failures.push({ message: message.problem });
        }
      }
    }

    if (retrieveResult.fileProperties) {
      const fileProperties = Array.isArray(retrieveResult.fileProperties)
        ? retrieveResult.fileProperties
        : [retrieveResult.fileProperties];
      for (const properties of fileProperties) {
        // not interested in the "Package" component at this time
        if (properties.type === 'Package') {
          continue;
        }
        successes.push({
          properties,
          component: retrievedSet
            .getSourceComponents({
              fullName: properties.fullName,
              type: this.options.registry.getTypeByName(properties.type),
            })
            .next().value,
        });
      }
    }

    let status = retrieveResult.status;

    if (failures.length > 0) {
      if (successes.length > 0) {
        status = RequestStatus.SucceededPartial;
      } else {
        status = RequestStatus.Failed;
      }
    }

    return {
      id: retrieveResult.id,
      status,
      successes,
      failures,
      success: status === RequestStatus.Succeeded || status === RequestStatus.SucceededPartial,
    };
  }
}
