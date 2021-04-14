/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ConvertOutputConfig, MetadataConverter } from '../convert';
import { ComponentSet } from '../collections';
import { ZipTreeContainer } from '../resolve';
import {
  ComponentStatus,
  FileResponse,
  MetadataApiRetrieveStatus,
  RequestStatus,
  RetrieveOptions,
  MetadataTransferResult,
  RetrieveRequest,
} from './types';
import { MetadataTransfer, MetadataTransferOptions } from './metadataTransfer';
import { MetadataApiRetrieveError } from '../errors';
import { normalizeToArray } from '../utils';
import { RegistryAccess } from '../registry';

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
    const { packageNames } = this.options;

    if (this.components.size === 0 && (!packageNames || packageNames.length === 0)) {
      throw new MetadataApiRetrieveError('error_no_components_to_retrieve');
    }

    const connection = await this.getConnection();
    const requestBody: RetrieveRequest = {
      apiVersion: this.components.apiVersion,
      unpackaged: this.components.getObject().Package,
    };

    // if we're retrieving with packageNames add it
    // otherwise don't - it causes errors if undefined or an empty array
    if (packageNames) {
      requestBody.packageNames = packageNames;
    }

    // @ts-ignore required callback
    return connection.metadata.retrieve(requestBody);
  }

  protected async checkStatus(id: string): Promise<MetadataApiRetrieveStatus> {
    const connection = await this.getConnection();
    // Recasting to use the project's RetrieveResult type
    const status = await connection.metadata.checkRetrieveStatus(id);
    status.fileProperties = normalizeToArray(status.fileProperties);
    return status as MetadataApiRetrieveStatus;
  }

  protected async post(result: MetadataApiRetrieveStatus): Promise<RetrieveResult> {
    let components: ComponentSet;
    if (result.status === RequestStatus.Succeeded) {
      components = await this.extract(Buffer.from(result.zipFile, 'base64'));
    }

    components = components ?? new ComponentSet(undefined, this.options.registry);

    await this.maybeSaveTempDirectory('source', components);

    return new RetrieveResult(result, components);
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
    const zipComponents = ComponentSet.fromSource({
      fsPaths: ['.'],
      registry: this.options.registry,
      tree: await ZipTreeContainer.create(zip),
    })
      .getSourceComponents()
      .toArray();

    const convertResult = await converter.convert(zipComponents, 'source', outputConfig);

    return new ComponentSet(convertResult.converted, this.options.registry);
  }
}
