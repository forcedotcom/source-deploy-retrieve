/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import * as fs from 'graceful-fs';
import * as unzipper from 'unzipper';
import { asBoolean, isString } from '@salesforce/ts-types';
import { Messages, SfError, Lifecycle } from '@salesforce/core';
import { ConvertOutputConfig, MetadataConverter } from '../convert';
import { ComponentSet } from '../collections';
import { SourceComponent, ZipTreeContainer } from '../resolve';
import { normalizeToArray } from '../utils';
import { RegistryAccess } from '../registry';
import { MetadataTransfer, MetadataTransferOptions } from './metadataTransfer';
import {
  AsyncResult,
  ComponentStatus,
  FileResponse,
  MetadataApiRetrieveStatus,
  MetadataTransferResult,
  PackageOption,
  RequestStatus,
  RetrieveExtractOptions,
  RetrieveOptions,
  RetrieveRequest,
} from './types';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.load('@salesforce/source-deploy-retrieve', 'sdr', [
  'error_no_job_id',
  'error_no_components_to_retrieve',
]);

export type MetadataApiRetrieveOptions = MetadataTransferOptions & RetrieveOptions & { registry?: RegistryAccess };

export class RetrieveResult implements MetadataTransferResult {
  // This ComponentSet is most likely just the components on the local file
  // system and is used to set the state of a SourceComponent to "Created"
  // rather than "Changed".
  private localComponents: ComponentSet;
  private fileResponses: FileResponse[];

  /**
   * @param response The metadata retrieve response from the server
   * @param components The ComponentSet of retrieved source components
   * @param localComponents The ComponentSet used to create the retrieve request
   */
  public constructor(
    public readonly response: MetadataApiRetrieveStatus,
    public readonly components: ComponentSet,
    localComponents?: ComponentSet
  ) {
    this.localComponents = new ComponentSet(localComponents?.getSourceComponents());
  }

  public getFileResponses(): FileResponse[] {
    if (this.response && this.fileResponses) {
      return this.fileResponses;
    }

    this.fileResponses = [];

    // construct failures
    if (this.response.messages) {
      const retrieveMessages = normalizeToArray(this.response.messages);

      for (const message of retrieveMessages) {
        // match type name and fullname of problem component
        const matches = new RegExp(/.+'(.+)'.+'(.+)'/).exec(message.problem);
        if (matches) {
          const [typeName, fullName] = matches.slice(1);
          this.fileResponses.push({
            fullName,
            type: typeName,
            state: ComponentStatus.Failed,
            error: message.problem,
            problemType: 'Error',
          });
        } else {
          this.fileResponses.push({
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
        state: this.localComponents.has(retrievedComponent) ? ComponentStatus.Changed : ComponentStatus.Created,
      };

      if (!type.children) {
        for (const filePath of retrievedComponent.walkContent()) {
          this.fileResponses.push(Object.assign({}, baseResponse, { filePath }));
        }
      }

      if (xml) {
        this.fileResponses.push(Object.assign({}, baseResponse, { filePath: xml }));
      }
    }

    return this.fileResponses;
  }
}

export class MetadataApiRetrieve extends MetadataTransfer<MetadataApiRetrieveStatus, RetrieveResult> {
  public static DEFAULT_OPTIONS: Partial<MetadataApiRetrieveOptions> = { merge: false };
  private options: MetadataApiRetrieveOptions;
  private orgId: string;

  public constructor(options: MetadataApiRetrieveOptions) {
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
      throw new SfError(messages.getMessage('error_no_job_id', ['retrieve']), 'MissingJobIdError');
    }

    const coerceBoolean = (field: unknown): boolean => {
      if (isString(field)) {
        return field.toLowerCase() === 'true';
      }
      return asBoolean(field, false);
    };
    const connection = await this.getConnection();

    // Cast RetrieveResult returned by jsForce to MetadataApiRetrieveStatus
    const status = (await connection.metadata.checkRetrieveStatus(this.id)) as MetadataApiRetrieveStatus;
    status.fileProperties = normalizeToArray(status.fileProperties);
    status.success = coerceBoolean(status.success);
    status.done = coerceBoolean(status.done);
    return status;
  }

  /**
   * Cancel the retrieve operation.
   *
   * Canceling a retrieve occurs immediately and requires no additional status
   * checks to the org, unlike {@link MetadataApiDeploy.cancel}.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  public async cancel(): Promise<void> {
    this.canceled = true;
  }

  public async post(result: MetadataApiRetrieveStatus): Promise<RetrieveResult> {
    let components: ComponentSet;
    const isMdapiRetrieve = this.options.format === 'metadata';

    if (result.status === RequestStatus.Succeeded) {
      const zipFileContents = Buffer.from(result.zipFile, 'base64');
      if (isMdapiRetrieve) {
        const name = this.options.zipFileName || 'unpackaged.zip';
        const zipFilePath = path.join(this.options.output, name);
        fs.writeFileSync(zipFilePath, zipFileContents);

        if (this.options.unzip) {
          const dir = await unzipper.Open.buffer(zipFileContents);
          const extractPath = path.join(this.options.output, path.parse(name).name);
          await dir.extract({ path: extractPath });
        }
      } else {
        components = await this.extract(zipFileContents);
      }
    }

    components ??= new ComponentSet(undefined, this.options.registry);

    const retrieveResult = new RetrieveResult(result, components, this.components);
    if (!isMdapiRetrieve) {
      // This should only be done when retrieving source format since retrieving
      // mdapi format has no conversion or events/hooks
      await this.maybeSaveTempDirectory('source', components);
      await Lifecycle.getInstance().emit('scopedPostRetrieve', {
        retrieveResult,
        orgId: this.orgId,
      } as ScopedPostRetrieve);
    }

    return retrieveResult;
  }

  protected async pre(): Promise<AsyncResult> {
    const packageNames = this.getPackageNames();

    if (this.components.size === 0 && !packageNames?.length) {
      throw new SfError(messages.getMessage('error_no_components_to_retrieve'), 'MetadataApiRetrieveError');
    }

    const connection = await this.getConnection();
    this.orgId = connection.getAuthInfoFields().orgId;

    // only do event hooks if source, (NOT a metadata format) retrieve
    if (this.options.components) {
      await Lifecycle.getInstance().emit('scopedPreRetrieve', {
        componentSet: this.options.components,
        orgId: this.orgId,
      } as ScopedPreRetrieve);
    }

    const requestBody: RetrieveRequest = {
      apiVersion: this.components.apiVersion ?? (await connection.retrieveMaxApiVersion()),
      unpackaged: (await this.components.getObject()).Package,
    };

    // if we're retrieving with packageNames add it
    // otherwise don't - it causes errors if undefined or an empty array
    if (packageNames?.length) {
      requestBody.packageNames = packageNames;
      // delete unpackaged when no components and metadata format to prevent
      // sending an empty unpackaged manifest.
      if (this.options.format === 'metadata' && this.components.size === 0) {
        delete requestBody.unpackaged;
      }
    }
    if (this.options.singlePackage) {
      requestBody.singlePackage = this.options.singlePackage;
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore required callback
    return connection.metadata.retrieve(requestBody);
  }

  private getPackageNames(): string[] {
    return this.getPackageOptions()?.map((pkg) => pkg.name);
  }

  private getPackageOptions(): PackageOption[] {
    const { packageOptions } = this.options;
    if (packageOptions?.length) {
      if (isString(packageOptions[0])) {
        const packageNames = packageOptions as string[];
        return packageNames.map((pkg) => ({ name: pkg, outputDir: pkg }));
      } else {
        const pkgs = packageOptions as PackageOption[];
        // If there isn't an outputDir specified, use the package name.
        return pkgs.map(({ name, outputDir }) => ({ name, outputDir: outputDir || name }));
      }
    }
  }

  private async extract(zip: Buffer): Promise<ComponentSet> {
    const components: SourceComponent[] = [];
    const { merge, output, registry } = this.options;
    const converter = new MetadataConverter(registry);
    const tree = await ZipTreeContainer.create(zip);

    const packages: RetrieveExtractOptions[] = [{ zipTreeLocation: 'unpackaged', outputDir: output }];
    const packageOpts = this.getPackageOptions();
    // eslint-disable-next-line no-unused-expressions
    packageOpts?.forEach(({ name, outputDir }) => {
      packages.push({ zipTreeLocation: name, outputDir });
    });

    for (const pkg of packages) {
      const outputConfig: ConvertOutputConfig = merge
        ? {
            type: 'merge',
            mergeWith: this.components.getSourceComponents(),
            defaultDirectory: pkg.outputDir,
            forceIgnoredPaths: this.components.forceIgnoredPaths ?? new Set<string>(),
          }
        : {
            type: 'directory',
            outputDirectory: pkg.outputDir,
          };
      const zipComponents = ComponentSet.fromSource({
        fsPaths: [pkg.zipTreeLocation],
        registry,
        tree,
      })
        .getSourceComponents()
        .toArray();
      const convertResult = await converter.convert(zipComponents, 'source', outputConfig);
      if (convertResult) {
        components.push(...convertResult.converted);
      }
    }
    return new ComponentSet(components, registry);
  }
}

/**
 * register a listener to `scopedPreRetrieve`
 */
export interface ScopedPreRetrieve {
  componentSet: ComponentSet;
  orgId: string;
}

/**
 * register a listener to `scopedPostRetrieve`
 */
export interface ScopedPostRetrieve {
  retrieveResult: RetrieveResult;
  orgId: string;
}
