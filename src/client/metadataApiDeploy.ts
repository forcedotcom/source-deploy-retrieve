/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join, relative, resolve as pathResolve, sep } from 'node:path';
import { format } from 'node:util';
import { isString } from '@salesforce/ts-types';
import JSZip from 'jszip';
import fs from 'graceful-fs';
import { Lifecycle, Messages, SfError } from '@salesforce/core';
import { ensureArray } from '@salesforce/kit';
import { RegistryAccess } from '../registry/registryAccess';
import { ReplacementEvent } from '../convert/types';
import { MetadataConverter } from '../convert/metadataConverter';
import { ComponentSet } from '../collections/componentSet';
import { MetadataTransfer, MetadataTransferOptions } from './metadataTransfer';
import {
  AsyncResult,
  ComponentStatus,
  DeployMessage,
  FileResponse,
  MetadataApiDeployOptions as ApiOptions,
  MetadataApiDeployStatus,
  MetadataTransferResult,
} from './types';
import {
  createResponses,
  getDeployMessages,
  getState,
  isComponentNotFoundWarningMessage,
  toKey,
} from './deployMessages';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

// TODO: (NEXT MAJOR) this should just be a readonly object and not a class.
export class DeployResult implements MetadataTransferResult {
  private fileResponses?: FileResponse[];

  public constructor(
    public readonly response: MetadataApiDeployStatus,
    public readonly components?: ComponentSet,
    public readonly replacements = new Map<string, string[]>()
  ) {}

  public getFileResponses(): FileResponse[] {
    // this involves FS operations, so only perform once!
    if (!this.fileResponses) {
      this.fileResponses = [
        // removes duplicates from the file responses by parsing the object into a string, used as the key of the map
        ...new Map(
          (this.components
            ? buildFileResponsesFromComponentSet(this.components)(this.response)
            : buildFileResponses(this.response)
          ).map((v) => [JSON.stringify(v), v])
        ).values(),
      ];
    }
    return this.fileResponses;
  }
}

export type MetadataApiDeployOptions = {
  apiOptions?: ApiOptions;
  /**
   * Path to a zip file containing mdapi-formatted code and a package.xml
   */
  zipPath?: string;
  /**
   * Path to a directory containing mdapi-formatted code and a package.xml
   */
  mdapiPath?: string;
  registry?: RegistryAccess;
} & MetadataTransferOptions;

export class MetadataApiDeploy extends MetadataTransfer<
  MetadataApiDeployStatus,
  DeployResult,
  MetadataApiDeployOptions
> {
  public static readonly DEFAULT_OPTIONS: Partial<MetadataApiDeployOptions> = {
    apiOptions: {
      rollbackOnError: true,
      ignoreWarnings: false,
      checkOnly: false,
      singlePackage: true,
      rest: false,
    },
  };
  private options: MetadataApiDeployOptions;
  private replacements: Map<string, Set<string>> = new Map();
  private orgId?: string;
  // Keep track of rest deploys separately since Connection.deploy() removes it
  // from the apiOptions and we need it for telemetry.
  private readonly isRestDeploy: boolean;
  private readonly registry: RegistryAccess;

  public constructor(options: MetadataApiDeployOptions) {
    super(options);
    options.apiOptions = { ...MetadataApiDeploy.DEFAULT_OPTIONS.apiOptions, ...options.apiOptions };
    this.options = Object.assign({}, options);
    this.isRestDeploy = !!options.apiOptions?.rest;
    this.registry = options.registry ?? new RegistryAccess();
  }

  /**
   * Deploy recently validated components without running Apex tests. Requires the operation to have been
   * created with the `{ checkOnly: true }` API option.
   *
   * Ensure that the following requirements are met before deploying a recent validation:
   * - The components have been validated successfully for the target environment within the last 10 days.
   * - As part of the validation, Apex tests in the target org have passed.
   * - Code coverage requirements are met.
   * - If all tests in the org or all local tests are run, overall code coverage is at least 75%, and Apex triggers have some coverage.
   * - If specific tests are run with the RunSpecifiedTests test level, each class and trigger that was deployed is covered by at least 75% individually.
   *
   * See [deployRecentValidation()](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_deployRecentValidation.htm)
   *
   * @param rest - Set to `true` to use the REST API, otherwise defaults to using SOAP
   * @returns The ID of the quick deployment
   */
  public async deployRecentValidation(rest = false): Promise<string> {
    if (!this.id) {
      throw new SfError(messages.getMessage('error_no_job_id', ['deploy']), 'MissingJobIdError');
    }

    const conn = await this.getConnection();
    const response = (await conn.metadata.deployRecentValidation({
      id: this.id,
      rest,
    })) as unknown as AsyncResult | string;
    return isString(response) ? response : response.id;
  }

  /**
   * Check the status of the deploy operation.
   *
   * @returns Status of the deploy
   */
  public async checkStatus(): Promise<MetadataApiDeployStatus> {
    if (!this.id) {
      throw new SfError(messages.getMessage('error_no_job_id', ['deploy']), 'MissingJobIdError');
    }
    const connection = await this.getConnection();
    // Recasting to use the project's version of the type
    return connection.metadata.checkDeployStatus(this.id, true) as unknown as MetadataApiDeployStatus;
  }

  /**
   * Cancel the deploy operation.
   *
   * Deploys are asynchronously canceled. Once the cancel request is made to the org,
   * check the status of the cancellation with `checkStatus`.
   */
  public async cancel(): Promise<void> {
    if (!this.id) {
      throw new SfError(messages.getMessage('error_no_job_id', ['deploy']), 'MissingJobIdError');
    }

    const connection = await this.getConnection();

    // jsforce has an <any> on this
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,no-underscore-dangle
    await connection.metadata._invoke('cancelDeploy', { id: this.id });
  }

  protected async pre(): Promise<AsyncResult> {
    const LifecycleInstance = Lifecycle.getInstance();
    const connection = await this.getConnection();
    const apiVersion = connection.getApiVersion();

    // store for use in the scopedPostDeploy event
    this.orgId = connection.getAuthInfoFields().orgId;

    // If we have a ComponentSet but no version info, use the apiVersion from the Connection.
    if (this.components) {
      // this is the SOAP/REST API version of the connection
      this.components.apiVersion ??= apiVersion;

      // this is used as the version in the manifest (package.xml).
      this.components.sourceApiVersion ??= apiVersion;
    }

    // only do event hooks if source, (NOT a metadata format) deploy
    if (this.options.components) {
      await LifecycleInstance.emit('scopedPreDeploy', {
        componentSet: this.options.components,
        orgId: this.orgId,
      } as ScopedPreDeploy);
    }

    LifecycleInstance.on(
      'replacement',
      async (replacement: ReplacementEvent) =>
        // lifecycle have to be async, so wrapped in a promise
        new Promise((resolve) => {
          if (!this.replacements.has(replacement.filename)) {
            this.replacements.set(replacement.filename, new Set([replacement.replaced]));
          } else {
            this.replacements.get(replacement.filename)?.add(replacement.replaced);
          }
          resolve();
        })
    );

    const [zipBuffer] = await Promise.all([this.getZipBuffer(), this.maybeSaveTempDirectory('metadata')]);
    // SDR modifies what the mdapi expects by adding a rest param
    const { rest, ...optionsWithoutRest } = this.options.apiOptions ?? {};

    // Event and Debug output for API version and source API version used for deploy
    const manifestVersion = this.components?.sourceApiVersion;
    const webService = rest ? 'REST' : 'SOAP';
    const manifestMsg = manifestVersion ? ` in v${manifestVersion} shape` : '';
    const debugMsg = format(`Deploying metadata source%s using ${webService} v${apiVersion}`, manifestMsg);
    this.logger.debug(debugMsg);
    await LifecycleInstance.emit('apiVersionDeploy', { webService, manifestVersion, apiVersion });

    return this.isRestDeploy
      ? connection.metadata.deployRest(zipBuffer, optionsWithoutRest)
      : connection.metadata.deploy(zipBuffer, optionsWithoutRest);
  }

  protected async post(result: MetadataApiDeployStatus): Promise<DeployResult> {
    const lifecycle = Lifecycle.getInstance();
    const connection = await this.getConnection();
    try {
      const apiVersion = connection.getApiVersion();
      // Creates an array of unique metadata types that were deployed, uses Set to avoid duplicates.
      let listOfMetadataTypesDeployed: string[];
      if (this.options.components) {
        listOfMetadataTypesDeployed = Array.from(new Set(this.options.components.map((c) => c.type.name)));
      } else {
        // mdapi deploys don't have a ComponentSet, so using the result
        const types = new Set<string>();
        const successes = ensureArray(result.details?.componentSuccesses);
        const failures = ensureArray(result.details?.componentFailures);
        [...successes, ...failures].forEach((c) => c.componentType && types.add(c.componentType));
        listOfMetadataTypesDeployed = Array.from(types);
      }

      void lifecycle.emitTelemetry({
        eventName: 'metadata_api_deploy_result',
        library: 'SDR',
        status: result.status,
        apiVersion,
        sourceApiVersion: this.components?.sourceApiVersion,
        createdDate: result.createdDate,
        startDate: result.startDate,
        completedDate: result.completedDate,
        rollbackOnError: result.rollbackOnError,
        runTestsEnabled: result.runTestsEnabled,
        isRestDeploy: this.isRestDeploy,
        checkOnly: result.checkOnly,
        done: result.done,
        ignoreWarnings: result.ignoreWarnings,
        metadataTypesDeployed: listOfMetadataTypesDeployed.toString(),
        numberComponentErrors: result.numberComponentErrors,
        numberComponentsDeployed: result.numberComponentsDeployed,
        numberComponentsTotal: result.numberComponentsTotal,
        numberTestErrors: result.numberTestErrors,
        numberTestsCompleted: result.numberTestsCompleted,
        numberTestsTotal: result.numberTestsTotal,
        testsTotalTime: result.details?.runTestResult?.totalTime,
        filesWithReplacementsQuantity: this.replacements.size ?? 0,
      });
    } catch (err) {
      const error = err as Error;
      this.logger.debug(
        `Error trying to compile/send deploy telemetry data for deploy ID: ${this.id}\nError: ${error.message}`
      );
    }
    const deployResult = new DeployResult(
      result,
      this.components,
      new Map(Array.from(this.replacements).map(([k, v]) => [k, Array.from(v)]))
    );
    // only do event hooks if source, (NOT a metadata format) deploy
    if (this.options.components) {
      // this may not be set if you resume a deploy so that `pre` is skipped.
      this.orgId ??= connection.getAuthInfoFields().orgId;
      // previous step ensures string exists
      if (this.orgId) {
        await lifecycle.emit<ScopedPostDeploy>('scopedPostDeploy', { deployResult, orgId: this.orgId });
      }
    }
    return deployResult;
  }

  private async getZipBuffer(): Promise<Buffer> {
    const mdapiPath = this.options.mdapiPath;
    if (mdapiPath) {
      if (!fs.existsSync(mdapiPath) || !fs.lstatSync(mdapiPath).isDirectory()) {
        throw messages.createError('error_directory_not_found_or_not_directory', [mdapiPath]);
      }

      const zip = JSZip();

      const zipDirRecursive = (dir: string): void => {
        const dirents = fs.readdirSync(dir, { withFileTypes: true });
        for (const dirent of dirents) {
          const fullPath = pathResolve(dir, dirent.name);
          if (dirent.isDirectory()) {
            zipDirRecursive(fullPath);
          } else {
            // Add relative file paths to a root of "zip" for MDAPI.
            const relPath = join('zip', relative(mdapiPath, fullPath));
            // Ensure only posix paths are added to zip files
            const relPosixPath = relPath.replace(/\\/g, '/');
            zip.file(relPosixPath, fs.createReadStream(fullPath));
          }
        }
      };
      this.logger.debug('Zipping directory for metadata deploy:', mdapiPath);
      zipDirRecursive(mdapiPath);

      return zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 },
      });
    }
    // read the zip into a buffer
    if (this.options.zipPath) {
      if (!fs.existsSync(this.options.zipPath)) {
        throw new SfError(messages.getMessage('error_path_not_found', [this.options.zipPath]));
      }
      // does encoding matter for zip files? I don't know
      return fs.promises.readFile(this.options.zipPath);
    }
    if (this.options.components && this.components) {
      const converter = new MetadataConverter(this.registry);
      const { zipBuffer } = await converter.convert(this.components, 'metadata', { type: 'zip' });
      if (!zipBuffer) {
        throw new SfError(messages.getMessage('zipBufferError'));
      }
      return zipBuffer;
    }
    throw new Error('Options should include components, zipPath, or mdapiPath');
  }
}

/**
 * If a component fails to delete because it doesn't exist in the org, you get a message like
 * key: 'ApexClass#destructiveChanges.xml'
 * value:[{
 * fullName: 'destructiveChanges.xml',
 * fileName: 'destructiveChanges.xml',
 * componentType: 'ApexClass',
 * problem: 'No ApexClass named: test1 found',
 * problemType: 'Warning'
 * }]
 */
const deleteNotFoundToFileResponses =
  (cs: ComponentSet) =>
  (messageMap: Map<string, DeployMessage[]>): FileResponse[] =>
    Array.from(messageMap)
      .filter(([key]) => key.includes('destructiveChanges') && key.endsWith('.xml'))
      .flatMap(
        ([, messageArray]): Array<DeployMessage & Required<Pick<DeployMessage, 'componentType' | 'problem'>>> =>
          messageArray.filter(isComponentNotFoundWarningMessage)
      )
      .flatMap((message) => {
        const fullName = message.problem.replace(`No ${message.componentType} named: `, '').replace(' found', '');
        return cs
          ? cs.getComponentFilenamesByNameAndType({ fullName, type: message.componentType }).map((fileName) => ({
              fullName,
              type: message.componentType,
              filePath: fileName,
              state: ComponentStatus.Deleted,
            }))
          : [];
      });

const warnIfUnmatchedServerResult =
  (fr: FileResponse[]) =>
  (messageMap: Map<string, DeployMessage[]>): void[] =>
    // keep the parents and children separated for MPD scenarios where we have a parent in one, children in another package
    [...messageMap.keys()].flatMap((key) => {
      const [type, fullName] = key.split('#');

      if (
        !fr.find((c) => c.type === type && c.fullName === fullName) &&
        !['package.xml', 'destructiveChanges.xml', 'destructiveChangesPost.xml', 'destructiveChangesPre.xml'].includes(
          fullName
        )
      ) {
        const deployMessage = messageMap.get(key)!.at(0)!;

        // warn that this component is found in server response, but not in component set
        void Lifecycle.getInstance().emitWarning(
          `${deployMessage.componentType}, ${deployMessage.fullName}, returned from org, but not found in the local project`
        );
      }
    });
const buildFileResponses = (response: MetadataApiDeployStatus): FileResponse[] =>
  ensureArray(response.details?.componentSuccesses)
    .concat(ensureArray(response.details?.componentFailures))
    .filter((c) => c.fullName !== 'package.xml')
    .map(
      (c) =>
        ({
          ...(getState(c) === ComponentStatus.Failed
            ? {
                error: c.problem,
                problemType: c.problemType,
                columnNumber: c.columnNumber ? parseInt(c.columnNumber, 10) : undefined,
                lineNumber: c.lineNumber ? parseInt(c.lineNumber, 10) : undefined,
              }
            : {}),
          fullName: c.fullName,
          type: c.componentType,
          state: getState(c),
          filePath: c.fileName.replace(`zip${sep}`, ''),
        } as FileResponse)
    );

const buildFileResponsesFromComponentSet =
  (cs: ComponentSet) =>
  (response: MetadataApiDeployStatus): FileResponse[] => {
    const responseMessages = getDeployMessages(response);

    const fileResponses = (cs.getSourceComponents().toArray() ?? [])
      .flatMap((deployedComponent) =>
        createResponses(deployedComponent, responseMessages.get(toKey(deployedComponent)) ?? []).concat(
          deployedComponent.type.children
            ? deployedComponent.getChildren().flatMap((child) => {
                const childMessages = responseMessages.get(toKey(child));
                return childMessages ? createResponses(child, childMessages) : [];
              })
            : []
        )
      )
      .concat(deleteNotFoundToFileResponses(cs)(responseMessages));

    warnIfUnmatchedServerResult(fileResponses)(responseMessages);
    return fileResponses;
  };
/**
 * register a listener to `scopedPreDeploy`
 */
export type ScopedPreDeploy = {
  componentSet: ComponentSet;
  orgId: string;
};

/**
 * register a listener to `scopedPostDeploy`
 */
export type ScopedPostDeploy = {
  deployResult: DeployResult;
  orgId: string;
};
