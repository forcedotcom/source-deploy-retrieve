/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { basename, dirname, extname, join, posix, sep } from 'path';
import { format } from 'util';
import { isString } from '@salesforce/ts-types';
import { create as createArchive } from 'archiver';
import * as fs from 'graceful-fs';
import { Lifecycle, Messages, SfError } from '@salesforce/core';
import { ensureArray } from '@salesforce/kit';
import { ReplacementEvent } from '../convert/types';
import { MetadataConverter } from '../convert';
import { ComponentLike, SourceComponent } from '../resolve';
import { ComponentSet } from '../collections';
import { registry } from '../registry';
import { stream2buffer } from '../convert/streams';
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
const messages = Messages.load('@salesforce/source-deploy-retrieve', 'sdr', ['error_no_job_id']);

export class DeployResult implements MetadataTransferResult {
  private readonly diagnosticUtil = new DiagnosticUtil('metadata');
  private fileResponses: FileResponse[];
  private readonly shouldConvertPaths = sep !== posix.sep;

  public constructor(
    public readonly response: MetadataApiDeployStatus,
    public readonly components: ComponentSet,
    public readonly replacements: Map<string, string[]> = new Map<string, string[]>()
  ) {}

  public getFileResponses(): FileResponse[] {
    // this involves FS operations, so only perform once!
    if (!this.fileResponses) {
      // TODO: Log when messages can't be mapped to components
      const responseMessages = this.getDeployMessages(this.response);
      const fileResponses: FileResponse[] = [];

      if (this.components) {
        for (const deployedComponent of this.components.getSourceComponents()) {
          if (deployedComponent.type.children) {
            for (const child of deployedComponent.getChildren()) {
              const childMessages = responseMessages.get(this.key(child));
              if (childMessages) {
                fileResponses.push(...this.createResponses(child, childMessages));
              }
            }
          }
          const componentMessages = responseMessages.get(this.key(deployedComponent));
          if (componentMessages) {
            fileResponses.push(...this.createResponses(deployedComponent, componentMessages));
          }
        }

        this.fileResponses = fileResponses.concat(this.deleteNotFoundToFileResponses(responseMessages));
      } else {
        // if no this.components, this was likely a metadata format deploy so we need to process
        // the componentSuccesses and componentFailures instead.
        const successes = ensureArray(this.response.details?.componentSuccesses);
        const failures = ensureArray(this.response.details?.componentFailures);
        for (const component of [...successes, ...failures]) {
          if (component.fullName === 'package.xml') continue;
          const baseResponse: Partial<FileResponse> = {
            fullName: component.fullName,
            type: component.componentType,
            state: getState(component),
            filePath: component.fileName.replace(`zip${sep}`, ''),
          };

          if (baseResponse.state === ComponentStatus.Failed) {
            baseResponse.error = component.problem;
            baseResponse.problemType = component.problemType;
          }

          fileResponses.push(baseResponse as FileResponse);
        }
        this.fileResponses = fileResponses;
      }
    }
    return this.fileResponses;
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
      messageMap.get(key).push(sanitized);
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
   * If a components fails to delete because it doesn't exist in the org, you get a message like
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
    const fileResponses: FileResponse[] = [];
    messageMap.forEach((responseMessages, key) => {
      if (key.includes('destructiveChanges') && key.endsWith('.xml')) {
        responseMessages.forEach((message) => {
          if (message.problemType === 'Warning' && message.problem.startsWith(`No ${message.componentType} named: `)) {
            const fullName = message.problem.replace(`No ${message.componentType} named: `, '').replace(' found', '');
            this.components
              .getComponentFilenamesByNameAndType({ fullName, type: message.componentType })
              .forEach((fileName) => {
                fileResponses.push({
                  fullName,
                  type: message.componentType,
                  filePath: fileName,
                  state: ComponentStatus.Deleted,
                });
              });
          }
        });
      }
    });
    return fileResponses;
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
  private orgId: string;
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
    const response = (await conn.deployRecentValidation({
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
            this.replacements.get(replacement.filename).add(replacement.replaced);
          }
          resolve();
        })
    );

    const [zipBuffer] = await Promise.all([this.getZipBuffer(), this.maybeSaveTempDirectory('metadata')]);
    // SDR modifies what the mdapi expects by adding a rest param
    const { rest, ...optionsWithoutRest } = this.options.apiOptions;

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
    try {
      const connection = await this.getConnection();
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
        testsTotalTime: result.details?.runTestResult.totalTime,
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
      await lifecycle.emit('scopedPostDeploy', { deployResult, orgId: this.orgId } as ScopedPostDeploy);
    }
    return deployResult;
  }

  private async getZipBuffer(): Promise<Buffer> {
    if (this.options.mdapiPath) {
      if (!fs.existsSync(this.options.mdapiPath) || !fs.lstatSync(this.options.mdapiPath).isDirectory()) {
        throw new Error(`Deploy directory ${this.options.mdapiPath} does not exist or is not a directory`);
      }
      // make a zip from the given directory
      const zip = createArchive('zip', { zlib: { level: 9 } });
      // anywhere not at the root level is fine
      zip.directory(this.options.mdapiPath, 'zip');
      // archiver/zip.finalize looks like it is async, because it extends streams, but it is not meant to be used that way
      // the typings on it are misleading and unintended.  More info https://github.com/archiverjs/node-archiver/issues/476
      // If you await it, bad things happen, like the convert process exiting silently.  https://github.com/forcedotcom/cli/issues/1791
      // leave the void as it is
      void zip.finalize();
      return stream2buffer(zip);
    }
    // read the zip into a buffer
    if (this.options.zipPath) {
      if (!fs.existsSync(this.options.zipPath)) {
        throw new Error(`Zip file ${this.options.zipPath} does not exist`);
      }
      // does encoding matter for zip files? I don't know
      return fs.promises.readFile(this.options.zipPath);
    }
    if (this.options.components) {
      const converter = new MetadataConverter();
      const { zipBuffer } = await converter.convert(this.components, 'metadata', { type: 'zip' });
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
const sanitizeDeployMessage = (message: DeployMessage): DeployMessage => {
  // mdapi error messages have the type as "FooSettings" but SDR only recognizes "Settings"
  if (message.componentType.endsWith('Settings') && message.fileName.endsWith('.settings')) {
    return {
      ...message,
      componentType: 'Settings',
    };
  }
  switch (message.componentType) {
    case registry.types.lightningcomponentbundle.name:
      // remove the markup scheme from fullName, including c: or custom namespaces
      message.fullName = message.fullName.replace(/markup:\/\/[a-z|0-9|_]+:/i, '');
      break;
    case registry.types.document.name:
      // strip document extension from fullName
      message.fullName = join(dirname(message.fullName), basename(message.fullName, extname(message.fullName)));
      break;
    // Treat emailTemplateFolder as EmailFolder
    case registry.types.emailtemplatefolder.name:
      message.componentType = registry.types.emailfolder.name;
      break;
    default:
  }
  return message;
};
