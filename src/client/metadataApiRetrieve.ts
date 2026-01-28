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
import { join, parse } from 'node:path';
import fs from 'graceful-fs';
import JSZip from 'jszip';
import { asBoolean, isString } from '@salesforce/ts-types';
import { Messages } from '@salesforce/core/messages';
import { SfError } from '@salesforce/core/sfError';
import { Lifecycle } from '@salesforce/core/lifecycle';
import { ensureArray } from '@salesforce/kit';
import { RegistryAccess } from '../registry/registryAccess';
import { ComponentSet } from '../collections/componentSet';
import { MetadataTransfer } from './metadataTransfer';
import {
  AsyncResult,
  ComponentStatus,
  FileResponse,
  FileResponseSuccess,
  MetadataApiRetrieveStatus,
  MetadataTransferResult,
  PackageOptions,
  RequestStatus,
  RetrieveRequest,
} from './types';
import { extract } from './retrieveExtract';
import { getPackageOptions } from './retrieveExtract';
import { MetadataApiRetrieveOptions } from './types';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

export class RetrieveResult implements MetadataTransferResult {
  // This ComponentSet is most likely just the components on the local file
  // system and is used to set the state of a SourceComponent to "Created"
  // rather than "Changed".
  private localComponents: ComponentSet;
  private fileResponses?: FileResponse[];

  /**
   * @param response The metadata retrieve response from the server
   * @param components The ComponentSet of retrieved source components
   * @param localComponents The ComponentSet used to create the retrieve request
   */
  public constructor(
    public readonly response: MetadataApiRetrieveStatus,
    public readonly components: ComponentSet,
    localComponents?: ComponentSet,
    private partialDeleteFileResponses: FileResponse[] = [],
    registry?: RegistryAccess
  ) {
    this.localComponents = new ComponentSet(localComponents?.getSourceComponents(), registry);
  }

  public getFileResponses(): FileResponse[] {
    if (this.response && this.fileResponses) {
      return this.fileResponses;
    }

    this.fileResponses = [];

    // construct failures
    if (this.response.messages) {
      const retrieveMessages = ensureArray(this.response.messages);

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
      const baseResponse = {
        fullName,
        type: type.name,
        state: this.localComponents.has(retrievedComponent) ? ComponentStatus.Changed : ComponentStatus.Created,
      } as const;

      if (!type.children || Object.values(type.children.types).some((t) => t.unaddressableWithoutParent)) {
        for (const filePath of retrievedComponent.walkContent()) {
          this.fileResponses.push({ ...baseResponse, filePath } satisfies FileResponseSuccess);
        }
      }

      if (xml) {
        this.fileResponses.push({ ...baseResponse, filePath: xml } satisfies FileResponseSuccess);
      }
    }

    // Add file responses for components that support partial delete (e.g., DigitalExperience)
    // where pieces of the component were deleted in the org, then retrieved.
    this.fileResponses.push(...(this.partialDeleteFileResponses ?? []));

    return this.fileResponses;
  }
}

export class MetadataApiRetrieve extends MetadataTransfer<
  MetadataApiRetrieveStatus,
  RetrieveResult,
  MetadataApiRetrieveOptions
> {
  public static DEFAULT_OPTIONS: Partial<MetadataApiRetrieveOptions> = { merge: false };
  private readonly options: MetadataApiRetrieveOptions;
  private orgId?: string;

  public constructor(options: MetadataApiRetrieveOptions) {
    super(options);
    this.options = Object.assign({}, MetadataApiRetrieve.DEFAULT_OPTIONS, options);
    if (this.mdapiTempDir) {
      this.mdapiTempDir = join(this.mdapiTempDir, `${new Date().toISOString().replace(/[<>:"\\|?*]/g, '_')}_retrieve`);
    }
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

    const connection = await this.getConnection();

    // Cast RetrieveResult returned by jsForce to MetadataApiRetrieveStatus
    const status = (await connection.metadata.checkRetrieveStatus(this.id)) as MetadataApiRetrieveStatus;

    return {
      ...status,
      // TODO: UT insist that this should NOT be an array
      // fileProperties: ensureArray(status.fileProperties),
      success: coerceBoolean(status.success),
      done: coerceBoolean(status.done),
    };
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
    let componentSet: ComponentSet | undefined;
    let partialDeleteFileResponses: FileResponse[] = [];
    const isMdapiRetrieve = this.options.format === 'metadata';

    if (result.status === RequestStatus.Succeeded) {
      const zipFileContents = Buffer.from(result.zipFile, 'base64');
      if (isMdapiRetrieve) {
        await handleMdapiResponse(this.options, zipFileContents);
      } else {
        // If mdapiTempDir is set, write the raw retrieve result to the temp dir
        if (this.mdapiTempDir && zipFileContents) {
          const outputDir = join(this.mdapiTempDir, 'metadata');
          fs.mkdirSync(outputDir, { recursive: true });
          const mdapiTempOptions = {
            usernameOrConnection: this.options.usernameOrConnection,
            output: outputDir,
            unzip: true,
          };
          await handleMdapiResponse(mdapiTempOptions, zipFileContents);
        }

        ({ componentSet, partialDeleteFileResponses } = await extract({
          zip: zipFileContents,
          options: {
            ...this.options,
            botVersionFilters: this.components?.botVersionFilters ?? this.options.botVersionFilters,
          },
          logger: this.logger,
          mainComponents: this.components,
        }));
      }
    }
    componentSet ??= new ComponentSet(undefined, this.options.registry);

    const retrieveResult = new RetrieveResult(
      result,
      componentSet,
      this.components,
      partialDeleteFileResponses,
      this.options.registry
    );
    if (!isMdapiRetrieve && !this.options.suppressEvents) {
      // This should only be done when retrieving source format since retrieving
      // mdapi format has no conversion or events/hooks
      await this.maybeSaveTempDirectory('source', componentSet);
      await Lifecycle.getInstance().emit('scopedPostRetrieve', {
        retrieveResult,
        orgId: this.orgId,
      } as ScopedPostRetrieve);
    }
    return retrieveResult;
  }

  protected async pre(): Promise<AsyncResult> {
    const packageNames = getPackageNames(this.options.packageOptions);

    if (this.components?.size === 0 && !packageNames?.length) {
      throw new SfError(messages.getMessage('error_no_components_to_retrieve'), 'MetadataApiRetrieveError');
    }

    const connection = await this.getConnection();
    const apiVersion = connection.getApiVersion();
    this.orgId = connection.getAuthInfoFields().orgId;

    if (this.components) {
      this.components.apiVersion ??= apiVersion;
      this.components.sourceApiVersion ??= apiVersion;
    }

    // only do event hooks if source, (NOT a metadata format) retrieve
    if (this.options.components && !this.options.suppressEvents) {
      await Lifecycle.getInstance().emit('scopedPreRetrieve', {
        componentSet: this.options.components,
        orgId: this.orgId,
      } as ScopedPreRetrieve);
    }

    const manifestData = (await this.components?.getObject())?.Package;

    const requestBody: RetrieveRequest = {
      // This apiVersion is only used when the version in the package.xml (manifestData) is not defined.
      // see docs here: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_retrieve_request.htm
      apiVersion: this.components?.sourceApiVersion ?? (await connection.retrieveMaxApiVersion()),
      ...(manifestData ? { unpackaged: manifestData } : {}),
      ...(this.options.singlePackage ? { singlePackage: this.options.singlePackage } : {}),
      ...(this.options.rootTypesWithDependencies
        ? { rootTypesWithDependencies: this.options.rootTypesWithDependencies }
        : {}),
      // if we're retrieving with packageNames add it
      // otherwise don't - it causes errors if undefined or an empty array
      ...(packageNames.length ? { packageNames } : {}),
    };

    if (packageNames?.length && this.options.format === 'metadata' && this.components?.size === 0) {
      // delete unpackaged when no components and metadata format to prevent
      // sending an empty unpackaged manifest.
      delete requestBody.unpackaged;
    }

    // Debug output for API version used for retrieve
    const manifestVersion = manifestData?.version;
    if (manifestVersion) {
      this.logger.debug(`Retrieving source in v${manifestVersion} shape using SOAP v${apiVersion}`);
      await Lifecycle.getInstance().emit('apiVersionRetrieve', { manifestVersion, apiVersion });
    }

    // TODO: are the jsforce types wrong?  ApiVersion string vs. number
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore required callback
    return connection.metadata.retrieve(requestBody);
  }
}

/**
 * register a listener to `scopedPreRetrieve`
 */
export type ScopedPreRetrieve = {
  componentSet: ComponentSet;
  orgId: string;
};

/**
 * register a listener to `scopedPostRetrieve`
 */
export type ScopedPostRetrieve = {
  retrieveResult: RetrieveResult;
  orgId: string;
};

const handleMdapiResponse = async (options: MetadataApiRetrieveOptions, zipFileContents: Buffer): Promise<void> => {
  const name = options.zipFileName ?? 'unpackaged.zip';
  const zipFilePath = join(options.output, name);
  fs.writeFileSync(zipFilePath, zipFileContents);

  if (options.unzip) {
    const zip = await JSZip.loadAsync(zipFileContents, { base64: true, createFolders: true });
    const extractPath = join(options.output, parse(name).name);
    fs.mkdirSync(extractPath, { recursive: true });
    for (const filePath of Object.keys(zip.files)) {
      const zipObj = zip.file(filePath);
      if (!zipObj || zipObj?.dir) {
        fs.mkdirSync(join(extractPath, filePath), { recursive: true });
      } else {
        // eslint-disable-next-line no-await-in-loop
        const content = await zipObj?.async('nodebuffer');
        if (content) {
          fs.writeFileSync(join(extractPath, filePath), content);
        }
      }
    }
  }
};

const coerceBoolean = (field: unknown): boolean => {
  if (isString(field)) {
    return field.toLowerCase() === 'true';
  }
  return asBoolean(field, false);
};

const getPackageNames = (packageOptions?: PackageOptions): string[] =>
  getPackageOptions(packageOptions)?.map((pkg) => pkg.name);
