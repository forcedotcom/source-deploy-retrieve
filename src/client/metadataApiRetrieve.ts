/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ConvertOutputConfig, MetadataConverter } from '../';
import { ComponentSet } from '../collections';
import { RegistryAccess, ZipTreeContainer } from '../metadata-registry';
import {
  ComponentStatus,
  FileResponse,
  MetadataApiRetrieveStatus,
  RequestStatus,
  RetrieveOptions,
  MetadataTransferResult,
} from './types';
import { MetadataTransfer, MetadataTransferOptions } from './metadataTransfer';
import { normalizeToArray } from '../utils';
import { MetadataApiRetrieveError } from '../errors';

export type MetadataApiRetrieveOptions = MetadataTransferOptions &
  RetrieveOptions & { registry?: RegistryAccess };

export class RetrieveResult implements MetadataTransferResult {
  public readonly response: MetadataApiRetrieveStatus;
  public readonly components: ComponentSet;

  constructor(response: MetadataApiRetrieveStatus, components: ComponentSet) {
    this.response = response;
    this.components = components;
  }

  public getFileResponses(): FileResponse[] {
    const responses: FileResponse[] = [];

    // construct failures
    if (this.response.messages) {
      const retrieveMessages = normalizeToArray(this.response.messages);

      for (const message of retrieveMessages) {
        // match type name and fullname of problem component
        const matches = message.problem.match(/.+'(.+)'.+'(.+)'/);
        if (matches) {
          const [typeName, fullName] = matches.slice(1);
          responses.push({
            fullName,
            type: typeName,
            state: ComponentStatus.Failed,
            error: message.problem,
            problemType: 'Error',
          });
        } else {
          responses.push({
            fullName: '',
            type: '',
            problemType: 'Error',
            state: ComponentStatus.Failed,
            error: message.problem,
          });
        }
      }
    }

    // construct successes
    for (const retrievedComponent of this.components.getSourceComponents()) {
      const { fullName, type, xml } = retrievedComponent;
      const baseResponse: FileResponse = {
        fullName,
        type: type.name,
        state: ComponentStatus.Changed,
      };

      if (!type.children) {
        for (const filePath of retrievedComponent.walkContent()) {
          responses.push(Object.assign({}, baseResponse, { filePath }));
        }
      }

      if (xml) {
        responses.push(Object.assign({}, baseResponse, { filePath: xml }));
      }
    }

    return responses;
  }
}

export class MetadataApiRetrieve extends MetadataTransfer<
  MetadataApiRetrieveStatus,
  RetrieveResult
> {
  public static DEFAULT_OPTIONS: Partial<MetadataApiRetrieveOptions> = { merge: false };
  private options: MetadataApiRetrieveOptions;

  constructor(options: MetadataApiRetrieveOptions) {
    super(options);
    this.options = Object.assign({}, MetadataApiRetrieve.DEFAULT_OPTIONS, options);
  }

  protected async pre(): Promise<{ id: string }> {
    // now that we can retrieve via packageNames, the ComponentSet size could theoretically be 0
    if (this.options.components.size === 0 && this.options.packageNames?.length === 0) {
      throw new MetadataApiRetrieveError('error_no_components_to_retrieve');
    }
    const connection = await this.getConnection();
    // if we're retrieving with packageNames add it
    // otherwise don't - it causes errors if undefined or an empty array
    const options = this.options.packageNames
      ? {
          packageNames: this.options.packageNames,
          apiVersion: this.components.apiVersion,
          unpackaged: this.components.getObject().Package,
        }
      : {
          apiVersion: this.components.apiVersion,
          unpackaged: this.components.getObject().Package,
        };
    // @ts-ignore required callback
    return connection.metadata.retrieve(options);
  }

  protected async checkStatus(id: string): Promise<MetadataApiRetrieveStatus> {
    const connection = await this.getConnection();
    // Recasting to use the project's RetrieveResult type
    return (connection.metadata.checkRetrieveStatus(id) as unknown) as Promise<
      MetadataApiRetrieveStatus
    >;
  }

  protected async post(result: MetadataApiRetrieveStatus): Promise<RetrieveResult> {
    let components: ComponentSet;
    if (result.status === RequestStatus.Succeeded) {
      components = await this.extract(Buffer.from(result.zipFile, 'base64'));
    }
    return new RetrieveResult(result, components ?? new ComponentSet());
  }

  protected async doCancel(): Promise<boolean> {
    // retrieve doesn't require signaling to the server to stop
    return true;
  }

  private async extract(zip: Buffer): Promise<ComponentSet> {
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

    return new ComponentSet(convertResult.converted, this.options.registry);
  }
}
