/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { basename, dirname, extname, join, posix, relative, resolve as pathResolve, sep } from 'node:path';
import { format } from 'node:util';
import { isString } from '@salesforce/ts-types';
import * as JSZip from 'jszip';
import * as fs from 'graceful-fs';
import { Lifecycle, Messages, SfError } from '@salesforce/core';
import { ensureArray } from '@salesforce/kit';
import { ReplacementEvent } from '../convert/types';
import { MetadataConverter } from '../convert';
import { ComponentLike, SourceComponent } from '../resolve';
import { ComponentSet } from '../collections';
import { registry } from '../registry';
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
import { DiagnosticUtil } from './diagnosticUtil';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

export class DeployResult implements MetadataTransferResult {
  private readonly diagnosticUtil = new DiagnosticUtil('metadata');
  private fileResponses?: FileResponse[];
  private readonly shouldConvertPaths = sep !== posix.sep;

  public constructor(
    public readonly response: MetadataApiDeployStatus,
    public readonly components?: ComponentSet,
    public readonly replacements: Map<string, string[]> = new Map<string, string[]>()
  ) {}

  public getFileResponses(): FileResponse[] {
    // this involves FS operations, so only perform once!
    if (!this.fileResponses) {
      if (this.components) {
        // TODO: Log when messages can't be mapped to components
        const responseMessages = this.getDeployMessages(this.response);

        this.fileResponses = (this.components.getSourceComponents().toArray() ?? [])
          .flatMap((deployedComponent) =>
            this.createResponses(deployedComponent, responseMessages.get(this.key(deployedComponent)) ?? []).concat(
              deployedComponent.type.children
                ? deployedComponent.getChildren().flatMap((child) => {
                    const childMessages = responseMessages.get(this.key(child));
                    return childMessages ? this.createResponses(child, childMessages) : [];
                  })
                : []
            )
          )
          .concat(this.deleteNotFoundToFileResponses(responseMessages));
      } else {
        // if no this.components, this was likely a metadata format deploy so we need to process
        // the componentSuccesses and componentFailures instead.
        this.fileResponses = ensureArray(this.response.details?.componentSuccesses)
          .concat(ensureArray(this.response.details?.componentFailures))
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
      }
    }
    // removes duplicates from the file responses by parsing the object into a string, used as the key of the map
    return [...new Map(this.fileResponses.map((v) => [JSON.stringify(v), v])).values()];
  }

  private createResponses(component: SourceComponent, responseMessages: DeployMessage[]): FileResponse[] {
    const { fullName, type, xml, content } = component;
    const responses: FileResponse[] = [];

    for (const message of responseMessages) {
      const baseResponse: Partial<FileResponse> = {
        fullName,
        type: type.name,
        state: getState(message),
      };

      if (baseResponse.state === ComponentStatus.Failed) {
        const diagnostic = this.diagnosticUtil.parseDeployDiagnostic(component, message);
        const response = Object.assign(baseResponse, diagnostic) as FileResponse;
        responses.push(response);
      } else {
        // components with children are already taken care of through the messages,
        // so don't walk their content directories.
        if (
          content &&
          (!type.children || Object.values(type.children.types).some((t) => t.unaddressableWithoutParent))
        ) {
          for (const filePath of component.walkContent()) {
            const response = { ...baseResponse, filePath } as FileResponse;
            responses.push(response);
          }
        }

        if (xml) {
          const response = { ...baseResponse, filePath: xml } as FileResponse;
          responses.push(response);
        }
      }
    }

    return responses;
  }

  /**
   * Groups messages from the deploy result by component fullName and type
   */
  private getDeployMessages(result: MetadataApiDeployStatus): Map<string, DeployMessage[]> {
    const messageMap = new Map<string, DeployMessage[]>();

    const failedComponents = new ComponentSet();
    const failureMessages = ensureArray(result.details.componentFailures);
    const successMessages = ensureArray(result.details.componentSuccesses);

    for (const failure of failureMessages) {
      const sanitized = sanitizeDeployMessage(failure);
      const componentLike: ComponentLike = {
        fullName: sanitized.fullName,
        type: sanitized.componentType,
      };
      const key = this.key(componentLike);
      if (!messageMap.has(key)) {
        messageMap.set(key, []);
      }
      messageMap.get(key)?.push(sanitized);
      failedComponents.add(componentLike);
    }

    for (const success of successMessages) {
      const sanitized = sanitizeDeployMessage(success);
      const componentLike: ComponentLike = {
        fullName: sanitized.fullName,
        type: sanitized.componentType,
      };
      const key = this.key(componentLike);
      // this will ensure successes aren't reported if there is a failure for
      // the same component. e.g. lwc returns failures and successes
      if (!failedComponents.has(componentLike)) {
        messageMap.set(key, [sanitized]);
      }
    }

    return messageMap;
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
  private deleteNotFoundToFileResponses(messageMap: Map<string, DeployMessage[]>): FileResponse[] {
    return Array.from(messageMap)
      .filter(([key]) => key.includes('destructiveChanges') && key.endsWith('.xml'))
      .flatMap(
        ([, messageArray]): Array<DeployMessage & Required<Pick<DeployMessage, 'componentType' | 'problem'>>> =>
          messageArray.filter(isComponentNotFoundWarningMessage)
      )
      .flatMap((message) => {
        const fullName = message.problem.replace(`No ${message.componentType} named: `, '').replace(' found', '');
        return this.components
          ? this.components
              .getComponentFilenamesByNameAndType({ fullName, type: message.componentType })
              .map((fileName) => ({
                fullName,
                type: message.componentType,
                filePath: fileName,
                state: ComponentStatus.Deleted,
              }))
          : [];
      });
  }

  private key(component: ComponentLike): string {
    const type = typeof component.type === 'string' ? component.type : component.type.name;
    return `${type}#${this.shouldConvertPaths ? component.fullName.split(sep).join(posix.sep) : component.fullName}`;
  }
}

export interface MetadataApiDeployOptions extends MetadataTransferOptions {
  apiOptions?: ApiOptions;
  /**
   * Path to a zip file containing mdapi-formatted code and a package.xml
   */
  zipPath?: string;
  /**
   * Path to a directory containing mdapi-formatted code and a package.xml
   */
  mdapiPath?: string;
}

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
  private isRestDeploy: boolean;

  public constructor(options: MetadataApiDeployOptions) {
    super(options);
    options.apiOptions = { ...MetadataApiDeploy.DEFAULT_OPTIONS.apiOptions, ...options.apiOptions };
    this.options = Object.assign({}, options);
    this.isRestDeploy = !!options.apiOptions?.rest;
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

  // eslint-disable-next-line @typescript-eslint/require-await
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
      const converter = new MetadataConverter();
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
 * register a listener to `scopedPreDeploy`
 */
export interface ScopedPreDeploy {
  componentSet: ComponentSet;
  orgId: string;
}

/**
 * register a listener to `scopedPostDeploy`
 */
export interface ScopedPostDeploy {
  deployResult: DeployResult;
  orgId: string;
}

const getState = (message: DeployMessage): ComponentStatus => {
  if (message.created === 'true' || message.created === true) {
    return ComponentStatus.Created;
  } else if (message.changed === 'true' || message.changed === true) {
    return ComponentStatus.Changed;
  } else if (message.deleted === 'true' || message.deleted === true) {
    return ComponentStatus.Deleted;
  } else if (message.success === 'false' || message.success === false) {
    return ComponentStatus.Failed;
  }
  return ComponentStatus.Unchanged;
};

/**
 * Fix any issues with the deploy message returned by the api.
 * TODO: remove cases if fixes are made in the api.
 */
const sanitizeDeployMessage = (message: DeployMessage): DeployMessage & { componentType: string } => {
  if (!hasComponentType(message)) {
    throw new SfError(`Missing componentType in deploy message ${message.fullName} ${message.fileName}`);
  }

  // mdapi error messages have the type as "FooSettings" but SDR only recognizes "Settings"
  if (message.componentType.endsWith('Settings') && message.fileName.endsWith('.settings')) {
    return {
      ...message,
      componentType: 'Settings',
    };
  }
  if (message.componentType === registry.types.lightningcomponentbundle.name) {
    return {
      ...message,
      fullName: message.fullName.replace(/markup:\/\/[a-z|0-9|_]+:/i, ''),
    };
  }
  if (message.componentType === registry.types.document.name) {
    return {
      ...message,
      // strip document extension from fullName
      fullName: join(dirname(message.fullName), basename(message.fullName, extname(message.fullName))),
    };
  }
  // Treat emailTemplateFolder as EmailFolder
  if (message.componentType === registry.types.emailtemplatefolder.name) {
    return {
      ...message,
      // strip document extension from fullName
      componentType: registry.types.emailfolder.name,
    };
  }
  return message;
};

/* Type guard for asserting that a DeployMessages has a componentType, problem, and problemType === Warning*/
const isComponentNotFoundWarningMessage = (
  message: DeployMessage
): message is DeployMessage & Required<Pick<DeployMessage, 'componentType' | 'problem' | 'problemType'>> =>
  hasComponentType(message) &&
  message.problemType === 'Warning' &&
  typeof message.problem === 'string' &&
  message.problem?.startsWith(`No ${message.componentType} named: `);

const hasComponentType = (message: DeployMessage): message is DeployMessage & { componentType: string } =>
  typeof message.componentType === 'string';
