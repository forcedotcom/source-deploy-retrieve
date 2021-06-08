/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ConvertOutputConfig, MetadataConverter } from '../convert';
import { ComponentSet } from '../collections';
import { SourceComponent, ZipTreeContainer } from '../resolve';
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
import { MetadataApiRetrieveError, MissingJobIdError } from '../errors';
import { normalizeToArray } from '../utils';
import { RegistryAccess } from '../registry';

export type MetadataApiRetrieveOptions = MetadataTransferOptions &
  RetrieveOptions & { registry?: RegistryAccess };

interface Package {
  name: string;
  zipTreeLocation: string;
}

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

  /**
   * Check the status of the retrieve operation.
   *
   * @returns Status of the retrieve
   */
  public async checkStatus(): Promise<MetadataApiRetrieveStatus> {
    if (!this.id) {
      throw new MissingJobIdError('retrieve');
    }
    const connection = await this.getConnection();
    // Recasting to use the project's RetrieveResult type
    const status = await connection.metadata.checkRetrieveStatus(this.id);
    status.fileProperties = normalizeToArray(status.fileProperties);
    return status as MetadataApiRetrieveStatus;
  }

  /**
   * Cancel the retrieve operation.
   *
   * Canceling a retrieve occurs immediately and requires no additional status
   * checks to the org, unlike {@link MetadataApiDeploy.cancel}.
   */
  public async cancel(): Promise<void> {
    this.canceled = true;
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

  protected async post(result: MetadataApiRetrieveStatus): Promise<RetrieveResult> {
    let components: ComponentSet;
    if (result.status === RequestStatus.Succeeded) {
      components = await this.extract(Buffer.from(result.zipFile, 'base64'));
    }

    components = components ?? new ComponentSet(undefined, this.options.registry);

    await this.maybeSaveTempDirectory('source', components);

    return new RetrieveResult(result, components);
  }

  private async extract(zip: Buffer): Promise<ComponentSet> {
    const components: SourceComponent[] = [];
    const converter = new MetadataConverter(this.options.registry);
    const { merge, output, packageNames } = this.options;
    const tree = await ZipTreeContainer.create(zip);
    // initialize with the specified output and unpackaged metadata
    const packageAggregator: Package[] = [{ name: output, zipTreeLocation: 'unpackaged' }];
    packageNames?.forEach((pkg) => {
      // add the retrieved packages - if they exist
      packageAggregator.push({ name: pkg, zipTreeLocation: pkg });
    });
    const validatedPackages = packageAggregator.filter((pkg) =>
      tree.isDirectory(pkg.zipTreeLocation)
    );
    for (const pkg of validatedPackages) {
      const outputConfig: ConvertOutputConfig = merge
        ? {
            type: 'merge',
            mergeWith: this.components.getSourceComponents(),
            defaultDirectory: pkg.name,
          }
        : {
            type: 'directory',
            // change pkg type
            outputDirectory: pkg.name,
          };
      const zipComponents = ComponentSet.fromSource({
        fsPaths: [pkg.zipTreeLocation],
        registry: this.options.registry,
        tree,
      })
        .getSourceComponents()
        .toArray();
      const convertResult = await converter.convert(zipComponents, 'source', outputConfig);
      components.push(...convertResult.converted);
    }
    return new ComponentSet(components, this.options.registry);
  }
}
