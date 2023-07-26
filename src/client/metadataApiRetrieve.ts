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
import { ensureArray } from '@salesforce/kit';
import { ConvertOutputConfig, MetadataConverter } from '../convert';
import { ComponentSet } from '../collections';
import { SourceComponent, ZipTreeContainer } from '../resolve';
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
  RetrieveOptions,
  RetrieveRequest,
} from './types';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

const partialDeleteFileResponses: FileResponse[] = [];

export type MetadataApiRetrieveOptions = MetadataTransferOptions & RetrieveOptions & { registry?: RegistryAccess };

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
    while (partialDeleteFileResponses.length) {
      const fromPartialDelete = partialDeleteFileResponses.pop();
      if (fromPartialDelete) {
        this.fileResponses.push(fromPartialDelete);
      }
    }

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

    const coerceBoolean = (field: unknown): boolean => {
      if (isString(field)) {
        return field.toLowerCase() === 'true';
      }
      return asBoolean(field, false);
    };
    const connection = await this.getConnection();

    // Cast RetrieveResult returned by jsForce to MetadataApiRetrieveStatus
    const status = (await connection.metadata.checkRetrieveStatus(this.id)) as MetadataApiRetrieveStatus;
    status.fileProperties = ensureArray(status.fileProperties);
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
        const name = this.options.zipFileName ?? 'unpackaged.zip';
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
    if (!isMdapiRetrieve && !this.options.suppressEvents) {
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
    };

    // if we're retrieving with packageNames add it
    // otherwise don't - it causes errors if undefined or an empty array
    if (packageNames?.length) {
      requestBody.packageNames = packageNames;
      // delete unpackaged when no components and metadata format to prevent
      // sending an empty unpackaged manifest.
      if (this.options.format === 'metadata' && this.components?.size === 0) {
        delete requestBody.unpackaged;
      }
    }
    if (this.options.singlePackage) {
      requestBody.singlePackage = this.options.singlePackage;
    }

    // Debug output for API version used for retrieve
    const manifestVersion = manifestData?.version;
    if (manifestVersion) {
      this.logger.debug(`Retrieving source in v${manifestVersion} shape using SOAP v${apiVersion}`);
      await Lifecycle.getInstance().emit('apiVersionRetrieve', { manifestVersion, apiVersion });
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore required callback
    return connection.metadata.retrieve(requestBody);
  }

  private getPackageNames(): string[] {
    return this.getPackageOptions()?.map((pkg) => pkg.name);
  }

  private getPackageOptions(): Array<Required<PackageOption>> {
    const { packageOptions } = this.options;
    return (packageOptions ?? []).map((po: string | PackageOption) =>
      isString(po) ? { name: po, outputDir: po } : { name: po.name, outputDir: po.outputDir ?? po.name }
    );
  }

  private async extract(zip: Buffer): Promise<ComponentSet> {
    let components: SourceComponent[] = [];
    const { merge, output, registry } = this.options;
    const converter = new MetadataConverter(registry);
    const tree = await ZipTreeContainer.create(zip);

    const packages = [{ zipTreeLocation: 'unpackaged', outputDir: output }].concat(
      this.getPackageOptions().map(({ name, outputDir }) => ({ zipTreeLocation: name, outputDir }))
    );

    for (const pkg of packages) {
      const outputConfig: ConvertOutputConfig = merge
        ? {
            type: 'merge',
            mergeWith: this.components?.getSourceComponents() ?? [],
            defaultDirectory: pkg.outputDir,
            forceIgnoredPaths: this.components?.forceIgnoredPaths ?? new Set<string>(),
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

      if (merge) {
        this.handlePartialDeleteMerges(zipComponents, tree);
      }

      // this is intentional sequential
      // eslint-disable-next-line no-await-in-loop
      const convertResult = await converter.convert(zipComponents, 'source', outputConfig);
      components = components.concat(convertResult?.converted ?? []);
    }
    return new ComponentSet(components, registry);
  }

  // Some bundle-like components can be partially deleted in the org, then retrieved. When this
  // happens, the deleted files need to be deleted on the file system and added to the FileResponses
  // that are returned by `RetrieveResult.getFileResponses()` for accuracy. The component types that
  // support this behavior are defined in the metadata registry with `"supportsPartialDelete": true`.
  // However, not all types can be partially deleted in the org. Currently this only applies to
  // DigitalExperienceBundle and ExperienceBundle.
  private handlePartialDeleteMerges(retrievedComponents: SourceComponent[], tree: ZipTreeContainer): void {
    interface PartialDeleteComp {
      contentPath: string;
      contentList: string[];
    }
    const partialDeleteComponents = new Map<string, PartialDeleteComp>();
    const mergeWithComponents = this.components?.getSourceComponents().toArray() ?? [];

    // Find all merge (local) components that support partial delete.
    mergeWithComponents.forEach((comp) => {
      if (comp.type.supportsPartialDelete && comp.content && fs.statSync(comp.content).isDirectory()) {
        const contentList = fs.readdirSync(comp.content);
        partialDeleteComponents.set(comp.fullName, { contentPath: comp.content, contentList });
      }
    });

    // If no partial delete components were in the mergeWith ComponentSet, no need to continue.
    if (partialDeleteComponents.size === 0) {
      return;
    }

    // Compare the contents of the retrieved components that support partial delete with the
    // matching merge components. If the merge components have files that the retrieved components
    // don't, delete the merge component and add all locally deleted files to the partial delete list
    // so that they are added to the `FileResponses` as deletes.
    retrievedComponents.forEach((comp) => {
      if (comp.type.supportsPartialDelete && partialDeleteComponents.has(comp.fullName)) {
        const localComp = partialDeleteComponents.get(comp.fullName);
        if (localComp?.contentPath && comp.content && tree.isDirectory(comp.content)) {
          const remoteContentList = tree.readDirectory(comp.content);

          const isForceIgnored = (filePath: string): boolean => {
            const ignored = comp.getForceIgnore().denies(filePath);
            if (ignored) {
              this.logger.debug(
                `Local component has ${filePath} while remote does not, but it is forceignored so ignoring.`
              );
            }
            return ignored;
          };

          localComp.contentList.forEach((fileName) => {
            if (!remoteContentList.includes(fileName)) {
              // If fileName is forceignored it is not counted as a diff. If fileName is a directory
              // we have to read the contents to check forceignore status or we might get a false
              // negative with `denies()` due to how the ignore library works.
              const fileNameFullPath = path.join(localComp.contentPath, fileName);
              if (fs.statSync(fileNameFullPath).isDirectory()) {
                const nestedFiles = fs.readdirSync(fileNameFullPath);
                if (nestedFiles.some((f) => isForceIgnored(path.join(fileNameFullPath, f)))) {
                  return;
                }
              } else if (isForceIgnored(fileNameFullPath)) {
                return;
              }

              this.logger.debug(
                `Local component (${comp.fullName}) contains ${fileName} while remote component does not. This file is being removed.`
              );

              const filePath = path.join(localComp.contentPath, fileName);
              partialDeleteFileResponses.push({
                fullName: comp.fullName,
                type: comp.type.name,
                state: ComponentStatus.Deleted,
                filePath,
              });
              fs.rmSync(filePath, { recursive: true, force: true });
            }
          });
        }
      }
    });
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
