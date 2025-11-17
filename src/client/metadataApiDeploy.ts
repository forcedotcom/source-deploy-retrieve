/*
 * Copyright 2025, Salesforce, Inc.
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
import { join, relative, resolve as pathResolve, sep } from 'node:path';
import { format } from 'node:util';
import { EOL } from 'node:os';
import { isString } from '@salesforce/ts-types';
import JSZip from 'jszip';
import fs from 'graceful-fs';
import { Lifecycle } from '@salesforce/core/lifecycle';
import { Messages } from '@salesforce/core/messages';
import { SfError } from '@salesforce/core/sfError';
import { envVars } from '@salesforce/core/envVars';
import { ensureArray } from '@salesforce/kit';
import { RegistryAccess } from '../registry';
import { ReplacementEvent } from '../convert/types';
import { MetadataConverter } from '../convert';
import { ComponentSet } from '../collections';
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
    public readonly replacements = new Map<string, string[]>(),
    public readonly zipMeta?: { zipSize: number; zipFileCount?: number }
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
  private zipSize?: number;
  private zipFileCount?: number;

  public constructor(options: MetadataApiDeployOptions) {
    super(options);
    options.apiOptions = { ...MetadataApiDeploy.DEFAULT_OPTIONS.apiOptions, ...options.apiOptions };
    validateOptions(options);
    this.options = Object.assign({}, options);
    this.isRestDeploy = !!options.apiOptions?.rest;
    this.registry = options.registry ?? new RegistryAccess();
    if (this.mdapiTempDir) {
      this.mdapiTempDir = join(this.mdapiTempDir, `${new Date().toISOString().replace(/[<>:"\\|?*]/g, '_')}_deploy`);
    }
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
    return connection.metadata.checkDeployStatus(
      this.id,
      true,
      this.isRestDeploy
    ) as unknown as MetadataApiDeployStatus;
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

    await connection.metadata.cancelDeploy(this.id);
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
    if (this.options.components) {
      // we must ensure AiAuthoringBundles compile before deployment
      // Use optimized getter method instead of filtering all components
      const aabComponents = this.options.components.getAiAuthoringBundles().toArray();

      if (aabComponents.length > 0) {
        // we need to use a namedJWT connection for this request
        const { accessToken, instanceUrl } = connection.getConnectionOptions();
        if (!instanceUrl) {
          throw SfError.create({
            name: 'ApiAccessError',
            message: 'Missing Instance URL for org connection',
          });
        }
        if (!accessToken) {
          throw SfError.create({
            name: 'ApiAccessError',
            message: 'Missing Access Token for org connection',
          });
        }
        const url = `${instanceUrl}/agentforce/bootstrap/nameduser`;
        // For the namdeduser endpoint request to work we need to delete the access token
        delete connection.accessToken;
        const response = await connection.request<{
          access_token: string;
        }>(
          {
            method: 'GET',
            url,
            headers: {
              'Content-Type': 'application/json',
              Cookie: `sid=${accessToken}`,
            },
          },
          { retry: { maxRetries: 3 } }
        );
        connection.accessToken = response.access_token;
        const results = await Promise.all(
          aabComponents.map(async (aab) => {
            // aab.content points to a directory, we need to find the .agent file and read it
            if (!aab.content) {
              throw new SfError(
                messages.getMessage('error_expected_source_files', [aab.fullName, 'aiauthoringbundle']),
                'ExpectedSourceFilesError'
              );
            }

            const contentPath = aab.tree.find('content', aab.name, aab.content);

            if (!contentPath) {
              // if this didn't exist, they'll have deploy issues anyways, but we can check here for type reasons
              throw new SfError(`No .agent file found in directory: ${aab.content}`, 'MissingAgentFileError');
            }

            const agentContent = await fs.promises.readFile(contentPath, 'utf-8');

            // to avoid circular dependencies between libraries, just call the compile endpoint here
            const result = await connection.request<{
              // minimal typings here, more is returned, just using what we need
              status: 'failure' | 'success';
              errors: Array<{
                description: string;
                lineStart: number;
                colStart: number;
              }>;
              // name added here for post-processing convenience
              name: string;
            }>({
              method: 'POST',
              // this will need to be api.salesforce once changes are in prod
              url: 'https://test.api.salesforce.com/einstein/ai-agent/v1.1/authoring/scripts',
              headers: {
                'x-client-name': 'afdx',
                'content-type': 'application/json',
              },
              body: JSON.stringify({
                assets: [
                  {
                    type: 'AFScript',
                    name: 'AFScript',
                    content: agentContent,
                  },
                ],
                afScriptVersion: '1.0.1',
              }),
            });
            result.name = aab.name;
            return result;
          })
        );

        const errors = results
          .filter((result) => result.status === 'failure')
          .map((result) =>
            result.errors.map((r) => `${result.name}.agent: ${r.description} ${r.lineStart}:${r.colStart}`).join(EOL)
          );

        if (errors.length > 0) {
          throw SfError.create({
            message: `${EOL}${errors.join(EOL)}`,
            name: 'AgentCompilationError',
          });
        }
      }
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

    const [{ zipBuffer, zipFileCount }] = await Promise.all([
      this.getZipBuffer(),
      this.maybeSaveTempDirectory('metadata'),
    ]);
    // SDR modifies what the mdapi expects by adding a rest param
    const { rest, ...optionsWithoutRest } = this.options.apiOptions ?? {};

    // Event and Debug output for API version and source API version used for deploy
    const manifestVersion = this.components?.sourceApiVersion;
    const webService = rest ? 'REST' : 'SOAP';
    const manifestMsg = manifestVersion ? ` in v${manifestVersion} shape` : '';
    const debugMsg = format(`Deploying metadata source%s using ${webService} v${apiVersion}`, manifestMsg);
    this.logger.debug(debugMsg);

    // Event and Debug output for the zip file used for deploy
    this.zipSize = zipBuffer.byteLength;
    let zipMessage = `Deployment zip file size = ${this.zipSize} Bytes`;
    if (zipFileCount) {
      this.zipFileCount = zipFileCount;
      zipMessage += ` containing ${zipFileCount} files`;
    }
    this.logger.debug(zipMessage);
    await LifecycleInstance.emit('apiVersionDeploy', { webService, manifestVersion, apiVersion });
    await LifecycleInstance.emit('deployZipData', { zipSize: this.zipSize, zipFileCount });
    await this.warnIfDeployThresholdExceeded(this.zipSize, zipFileCount);

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
        zipSize: this.zipSize ?? 0,
        zipFileCount: this.zipFileCount ?? 0,
      });
    } catch (err) {
      const error = err as Error;
      this.logger.debug(
        `Error trying to compile/send deploy telemetry data for deploy ID: ${this.id ?? '<not provided>'}\nError: ${
          error.message
        }`
      );
    }
    const deployResult = new DeployResult(
      result,
      this.components,
      new Map(Array.from(this.replacements).map(([k, v]) => [k, Array.from(v)])),
      { zipSize: this.zipSize ?? 0, zipFileCount: this.zipFileCount }
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

  // By default, an 80% deploy size threshold is used to warn users when their deploy size
  // is approaching the limit enforced by the Metadata API.  This includes the number of files
  // being deployed as well as the byte size of the deployment.  The threshold can be overridden
  // to be a different percentage using the SF_DEPLOY_SIZE_THRESHOLD env var. An env var value
  // of 100 would disable the client side warning. An env var value of 0 would always warn.
  private async warnIfDeployThresholdExceeded(zipSize: number, zipFileCount: number | undefined): Promise<void> {
    const thresholdPercentage = Math.abs(envVars.getNumber('SF_DEPLOY_SIZE_THRESHOLD', 80));
    if (thresholdPercentage >= 100) {
      this.logger.debug(
        `Deploy size warning is disabled since SF_DEPLOY_SIZE_THRESHOLD is overridden to: ${thresholdPercentage}`
      );
      return;
    }
    if (thresholdPercentage !== 80) {
      this.logger.debug(
        `Deploy size warning threshold has been overridden by SF_DEPLOY_SIZE_THRESHOLD to: ${thresholdPercentage}`
      );
    }
    // 39_000_000 is 39 MB in decimal format, which is the format used in buffer.byteLength
    const fileSizeThreshold = Math.round(39_000_000 * (thresholdPercentage / 100));
    const fileCountThreshold = Math.round(10_000 * (thresholdPercentage / 100));

    if (zipSize > fileSizeThreshold) {
      await Lifecycle.getInstance().emitWarning(
        `Deployment zip file size is approaching the Metadata API limit (~39MB). Warning threshold is ${thresholdPercentage}% and size ${zipSize} > ${fileSizeThreshold}`
      );
    }

    if (zipFileCount && zipFileCount > fileCountThreshold) {
      await Lifecycle.getInstance().emitWarning(
        `Deployment zip file count is approaching the Metadata API limit (10,000). Warning threshold is ${thresholdPercentage}% and count ${zipFileCount} > ${fileCountThreshold}`
      );
    }
  }

  private async getZipBuffer(): Promise<{ zipBuffer: Buffer; zipFileCount?: number }> {
    const mdapiPath = this.options.mdapiPath;

    // Zip a directory of metadata format source
    if (mdapiPath) {
      if (!fs.existsSync(mdapiPath) || !fs.lstatSync(mdapiPath).isDirectory()) {
        throw messages.createError('error_directory_not_found_or_not_directory', [mdapiPath]);
      }

      const zip = JSZip();
      let zipFileCount = 0;

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
            zipFileCount++;
          }
        }
      };
      this.logger.debug(`Zipping directory for metadata deploy: ${mdapiPath}`);
      zipDirRecursive(mdapiPath);

      return {
        zipBuffer: await zip.generateAsync({
          type: 'nodebuffer',
          compression: 'DEFLATE',
          compressionOptions: { level: 9 },
        }),
        zipFileCount,
      };
    }
    // Read a zip of metadata format source into a buffer
    if (this.options.zipPath) {
      if (!fs.existsSync(this.options.zipPath)) {
        throw new SfError(messages.getMessage('error_path_not_found', [this.options.zipPath]));
      }
      // does encoding matter for zip files? I don't know
      return { zipBuffer: await fs.promises.readFile(this.options.zipPath) };
    }
    // Convert a ComponentSet of metadata in source format and zip
    if (this.options.components && this.components) {
      const converter = new MetadataConverter(this.registry);
      const { zipBuffer, zipFileCount } = await converter.convert(this.components, 'metadata', { type: 'zip' });
      if (!zipBuffer) {
        throw new SfError(messages.getMessage('zipBufferError'));
      }
      return { zipBuffer, zipFileCount };
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
          `${deployMessage.componentType ?? '<no component type in deploy message>'}, ${
            deployMessage.fullName
          }, returned from org, but not found in the local project`
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

    if (cs.size) {
      warnIfUnmatchedServerResult(fileResponses)(responseMessages);
    }
    return fileResponses;
  };

const validateOptions = (options: MetadataApiDeployOptions): void => {
  const runningRelevantTestsOnly = options.apiOptions?.testLevel === 'RunRelevantTests';
  const beforeApiV66 = options.apiVersion && Number(options.apiVersion) < 66.0;
  if (runningRelevantTestsOnly && beforeApiV66) {
    throw new SfError(
      messages.getMessage('error_invalid_test_level', ['RunRelevantTests', '66.0']),
      'InvalidTestLevelSelection'
    );
  }
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
