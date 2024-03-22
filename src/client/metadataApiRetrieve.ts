/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'node:path';
import * as fs from 'graceful-fs';
import * as JSZip from 'jszip';
import { asBoolean, isString } from '@salesforce/ts-types';
import { Messages, SfError, Lifecycle, Logger } from '@salesforce/core';
import { ensureArray } from '@salesforce/kit';
import { fnJoin } from '../utils/path';
import { ComponentSet } from '../collections/componentSet';
import { ZipTreeContainer } from '../resolve/treeContainers';
import { SourceComponent } from '../resolve/sourceComponent';
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
    private partialDeleteFileResponses: FileResponse[] = []
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
      const baseResponse: FileResponse = {
        fullName,
        type: type.name,
        state: this.localComponents.has(retrievedComponent) ? ComponentStatus.Changed : ComponentStatus.Created,
      };

      if (!type.children || Object.values(type.children.types).some((t) => t.unaddressableWithoutParent)) {
        for (const filePath of retrievedComponent.walkContent()) {
          this.fileResponses.push(Object.assign({}, baseResponse, { filePath }));
        }
      }

      if (xml) {
        this.fileResponses.push(Object.assign({}, baseResponse, { filePath: xml }));
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
  private options: MetadataApiRetrieveOptions;
  private orgId?: string;

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
        ({ componentSet, partialDeleteFileResponses } = await extract({
          zip: zipFileContents,
          options: this.options,
          logger: this.logger,
          mainComponents: this.components,
        }));
      }
    }

    componentSet ??= new ComponentSet(undefined, this.options.registry);

    const retrieveResult = new RetrieveResult(result, componentSet, this.components, partialDeleteFileResponses);
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

const handleMdapiResponse = async (options: MetadataApiRetrieveOptions, zipFileContents: Buffer): Promise<void> => {
  const name = options.zipFileName ?? 'unpackaged.zip';
  const zipFilePath = path.join(options.output, name);
  fs.writeFileSync(zipFilePath, zipFileContents);

  if (options.unzip) {
    const zip = await JSZip.loadAsync(zipFileContents, { base64: true, createFolders: true });
    const extractPath = path.join(options.output, path.parse(name).name);
    fs.mkdirSync(extractPath, { recursive: true });
    for (const filePath of Object.keys(zip.files)) {
      const zipObj = zip.file(filePath);
      if (!zipObj || zipObj?.dir) {
        fs.mkdirSync(path.join(extractPath, filePath), { recursive: true });
      } else {
        // eslint-disable-next-line no-await-in-loop
        const content = await zipObj?.async('nodebuffer');
        if (content) {
          fs.writeFileSync(path.join(extractPath, filePath), content);
        }
      }
    }
  }
};

export const deleteFilePath =
  (logger: Logger) =>
  (fr: FileResponseSuccess): FileResponseSuccess => {
    if (fr.filePath) {
      logger.debug(
        `Local component (${fr.fullName}) contains ${fr.filePath} while remote component does not. This file is being removed.`
      );
      fs.rmSync(fr.filePath, { recursive: true, force: true });
    }

    return fr;
  };

export const supportsPartialDeleteAndHasContent = (
  comp: SourceComponent
): comp is SourceComponent & { content: string } =>
  supportsPartialDelete(comp) && typeof comp.content === 'string' && fs.statSync(comp.content).isDirectory();

export const supportsPartialDeleteAndHasZipContent =
  (tree: ZipTreeContainer) =>
  (comp: SourceComponent): comp is SourceComponent & { content: string } =>
    supportsPartialDelete(comp) && typeof comp.content === 'string' && tree.isDirectory(comp.content);

export const supportsPartialDeleteAndIsInMap =
  (partialDeleteComponents: Map<string, PartialDeleteComp>) =>
  (comp: SourceComponent): boolean =>
    supportsPartialDelete(comp) && partialDeleteComponents.has(comp.fullName);

const supportsPartialDelete = (comp: SourceComponent): boolean => comp.type.supportsPartialDelete === true;

// If fileName is forceignored it is not counted as a diff. If fileName is a directory
// we have to read the contents to check forceignore status or we might get a false
// negative with `denies()` due to how the ignore library works.
export const pathOrSomeChildIsIgnored =
  (logger: Logger) =>
  (component: SourceComponent) =>
  (localComp: PartialDeleteComp) =>
  (fileName: string): boolean => {
    const fileNameFullPath = path.join(localComp.contentPath, fileName);
    return fs.statSync(fileNameFullPath).isDirectory()
      ? fs.readdirSync(fileNameFullPath).map(fnJoin(fileNameFullPath)).some(isForceIgnored(logger)(component))
      : isForceIgnored(logger)(component)(fileNameFullPath);
  };

const isForceIgnored =
  (logger: Logger) =>
  (comp: SourceComponent) =>
  (filePath: string): boolean => {
    const ignored = comp.getForceIgnore().denies(filePath);
    if (ignored) {
      logger.debug(`Local component has ${filePath} while remote does not, but it is forceignored so ignoring.`);
    }
    return ignored;
  };

export type PartialDeleteComp = {
  contentPath: string;
  contentList: string[];
};

const coerceBoolean = (field: unknown): boolean => {
  if (isString(field)) {
    return field.toLowerCase() === 'true';
  }
  return asBoolean(field, false);
};

const getPackageNames = (packageOptions?: PackageOptions): string[] =>
  getPackageOptions(packageOptions)?.map((pkg) => pkg.name);
