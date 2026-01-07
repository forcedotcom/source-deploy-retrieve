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
/* eslint-disable complexity */
import { join, sep } from 'node:path';
import { assert } from 'chai';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { ensureArray } from '@salesforce/kit';
import { PollingClient } from '@salesforce/core';
import { SinonSpy, SinonStub } from 'sinon';
import type { AsyncResult } from '@jsforce/jsforce-node/lib/api/metadata';
import { ensureString } from '@salesforce/ts-types';
import {
  ComponentSet,
  ConvertOutputConfig,
  MetadataApiDeploy,
  MetadataApiRetrieve,
  MetadataConverter,
  RetrieveMessage,
  SourceComponent,
} from '../../../src';
import {
  DeployMessage,
  FileProperties,
  MetadataApiDeployOptions,
  MetadataApiDeployStatus,
  MetadataApiRetrieveStatus,
  PackageOption,
  RequestStatus,
} from '../../../src/client/types';
import { ComponentProperties } from '../../../src/resolve/sourceComponent';
import * as streams from '../../../src/convert/streams';
import { createMockZip } from './index';

export const MOCK_ASYNC_RESULT: AsyncResult = { id: '1234', state: RequestStatus.Pending, done: false };
export const MOCK_DEFAULT_OUTPUT = sep + 'test';
export const MOCK_RECENTLY_VALIDATED_ID_REST = { id: '1234567890' };
export const MOCK_RECENTLY_VALIDATED_ID_SOAP = '0987654321';

type DeployStubOptions = {
  components?: ComponentSet;
  zipPath?: string;
  mdapiPath?: string;
  componentSuccesses?: Partial<DeployMessage> | Array<Partial<DeployMessage>>;
  componentFailures?: Partial<DeployMessage> | Array<Partial<DeployMessage>>;
  apiOptions?: MetadataApiDeployOptions;
  id?: string;
};

type DeployOperationLifecycle = {
  pollingClientSpy: SinonSpy;
  deployStub: SinonStub;
  convertStub: SinonStub;
  checkStatusStub: SinonStub;
  deployRecentlyValidatedIdStub: SinonStub;
  invokeStub: SinonStub;
  invokeResultStub: SinonStub;
  operation: MetadataApiDeploy;
  response: MetadataApiDeployStatus;
};

export async function stubMetadataDeploy(
  $$: TestContext,
  testOrg: MockTestOrgData,
  options: DeployStubOptions = { components: new ComponentSet() }
): Promise<DeployOperationLifecycle> {
  const sandbox = $$.SANDBOX;
  const zipBuffer = Buffer.from('1234');
  const connection = await testOrg.getConnection();

  const deployStub = sandbox.stub(connection.metadata, 'deploy');
  const deployRestStub = sandbox.stub(connection.metadata, 'deployRest');
  const pollingClientSpy = sandbox.spy(PollingClient, 'create');

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { rest, ...defaultOptions } = MetadataApiDeploy.DEFAULT_OPTIONS.apiOptions ?? {};
  deployRestStub.withArgs(zipBuffer, options.apiOptions ?? defaultOptions).resolves(MOCK_ASYNC_RESULT);

  deployStub.withArgs(zipBuffer, options.apiOptions ?? defaultOptions).resolves(MOCK_ASYNC_RESULT);

  const deployRecentlyValidatedIdStub = sandbox.stub(connection.metadata, 'deployRecentValidation');
  deployRecentlyValidatedIdStub
    .withArgs({ id: MOCK_ASYNC_RESULT.id, rest: true })
    .resolves(MOCK_RECENTLY_VALIDATED_ID_REST.id)
    .withArgs({ id: MOCK_ASYNC_RESULT.id, rest: false })
    // @ts-ignore overriding return type to match API
    .resolves(MOCK_RECENTLY_VALIDATED_ID_SOAP);

  const convertStub = sandbox.stub(MetadataConverter.prototype, 'convert');
  if (options.components) {
    convertStub.withArgs(options.components, 'metadata', { type: 'zip' }).resolves({ zipBuffer });
  }

  // Stub getPipeline to return a function that resolves
  const mockPipeline = sandbox.stub().resolves();
  sandbox.stub(streams, 'getPipeline').returns(mockPipeline);

  const defaultStatus = { success: false, done: false, status: RequestStatus.Pending, checkOnly: false };
  const status: Partial<MetadataApiDeployStatus> = Object.assign(defaultStatus, MOCK_ASYNC_RESULT);
  if (options.componentSuccesses) {
    if (options.componentFailures) {
      status.status = RequestStatus.SucceededPartial;
    } else {
      status.status = RequestStatus.Succeeded;
    }
    status.details = {};
    // @ts-ignore
    status.details.componentSuccesses = options.componentSuccesses;
    status.success = true;
  } else {
    status.status = RequestStatus.Failed;
    status.success = false;
  }
  if (options.componentFailures) {
    if (!status.details) {
      status.details = {};
    }
    // @ts-ignore
    status.details.componentFailures = options.componentFailures;
  }
  status.done = true;
  const checkStatusStub = sandbox.stub(connection.metadata, 'checkDeployStatus');
  // Make the stub more permissive to handle all argument combinations
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
  checkStatusStub.resolves(status as any);

  // @ts-ignore
  const invokeStub = sandbox.stub(connection.metadata, '_invoke');
  const invokeResultStub = sandbox.stub();
  invokeStub.returns({
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    then: (f: (result: unknown | null) => void) => f(invokeResultStub()),
  });

  return {
    pollingClientSpy,
    deployStub,
    convertStub,
    checkStatusStub,
    invokeStub,
    invokeResultStub,
    deployRecentlyValidatedIdStub,
    operation: new MetadataApiDeploy({
      usernameOrConnection: connection,
      components: options.components,
      id: options.id,
      apiOptions: {
        rest: options.apiOptions?.rest,
      },
    }),
    response: status as MetadataApiDeployStatus,
  };
}

type RetrieveStubOptions = {
  merge?: boolean;
  packageOptions?: string[] | PackageOption[];
  toRetrieve?: ComponentSet;
  messages?: Partial<RetrieveMessage> | Array<Partial<RetrieveMessage>>;
  successes?: ComponentSet;
  rootTypesWithDependencies?: string[];
};

type RetrieveOperationLifecycle = {
  retrieveStub: SinonStub;
  checkStatusStub: SinonStub;
  convertStub: SinonStub;
  operation: MetadataApiRetrieve;
  response: MetadataApiRetrieveStatus;
};

/**
 * A stubber that simulates the API retrieve.
 *
 * @param $$ TestContext to stub against
 * @param options Options to stub out the retrieve
 */
export async function stubMetadataRetrieve(
  $$: TestContext,
  testOrg: MockTestOrgData,
  options: RetrieveStubOptions
): Promise<RetrieveOperationLifecycle> {
  const { toRetrieve: retrievedComponents, packageOptions: packages } = options;
  assert(retrievedComponents, 'toRetrieve is required');
  const connection = await testOrg.getConnection();

  const retrieveStub = $$.SANDBOX.stub(connection.metadata, 'retrieve').resolves(MOCK_ASYNC_RESULT);

  const retrieveStatus: Partial<MetadataApiRetrieveStatus> = {
    id: MOCK_ASYNC_RESULT.id,
    status: RequestStatus.Pending,
    success: false,
    done: true,
  };

  const zipEntries = ['unpackaged/package.xml'];

  const successes = options.successes?.getSourceComponents().toArray();

  if (successes?.length) {
    retrieveStatus.success = true;
    retrieveStatus.status = RequestStatus.Succeeded;
    const fileProperties: Array<Partial<FileProperties>> = [];

    for (const success of successes) {
      const contentFiles = success.walkContent();
      if (contentFiles.length > 0) {
        for (const content of success.walkContent()) {
          fileProperties.push({
            fullName: success.fullName,
            type: success.type.name,
            fileName: content,
          });
          if (!packages) {
            zipEntries.push(join('unpackaged', content));
          } else {
            let packageNames: string[] = [];
            if (typeof packages[0] === 'string') {
              packageNames = packages as string[];
            } else {
              packageNames = (packages as PackageOption[]).map((pkg) => pkg.name);
            }
            if (packageNames.some((pkg) => content.startsWith(pkg))) {
              zipEntries.push(content);
            }
          }
        }
      } else {
        fileProperties.push({
          fullName: success.fullName,
          type: success.type.name,
          fileName: success.xml,
        });
      }
    }
    retrieveStatus.fileProperties =
      fileProperties.length === 1 ? (fileProperties[0] as FileProperties) : (fileProperties as FileProperties[]);
  }

  const messages = ensureArray(options.messages);

  if (messages.length > 0) {
    retrieveStatus.status =
      retrieveStatus.status === RequestStatus.Succeeded ? RequestStatus.SucceededPartial : RequestStatus.Failed;
    retrieveStatus.messages =
      messages.length === 1 ? (messages[0] as RetrieveMessage) : (messages as RetrieveMessage[]);
  }

  retrieveStatus.zipFile = (await createMockZip(zipEntries)).toString('base64');

  const checkStatusStub = $$.SANDBOX.stub(connection.metadata, 'checkRetrieveStatus');
  // @ts-ignore force returning project's RetrieveResult type
  checkStatusStub.withArgs(MOCK_ASYNC_RESULT.id).resolves(retrieveStatus);

  const source = retrievedComponents?.getSourceComponents().toArray() ?? [];

  const outputConfigs: ConvertOutputConfig[] = [];
  let converted: SourceComponent[] = [];
  let pkgs: PackageOption[] | undefined;

  if (packages) {
    if (typeof packages[0] === 'string') {
      pkgs = (packages as string[]).map((pkg) => ({ name: pkg, outputDir: pkg }));
    } else {
      pkgs = packages as PackageOption[];
    }
  }

  if (options.merge) {
    outputConfigs.push({
      type: 'merge',
      mergeWith: retrievedComponents.getSourceComponents(),
      defaultDirectory: MOCK_DEFAULT_OUTPUT,
      forceIgnoredPaths: retrievedComponents.forceIgnoredPaths ?? new Set<string>(),
    });
    converted = source;

    pkgs?.forEach((pkg) =>
      outputConfigs.push({
        type: 'merge',
        mergeWith: retrievedComponents.getSourceComponents(),
        defaultDirectory: ensureString(pkg.outputDir ?? pkg.name),
        forceIgnoredPaths: retrievedComponents.forceIgnoredPaths ?? new Set<string>(),
      })
    );
  } else {
    outputConfigs.push({
      type: 'directory',
      outputDirectory: MOCK_DEFAULT_OUTPUT,
    });
    for (const component of successes ?? []) {
      const props: ComponentProperties = {
        name: component.fullName,
        type: component.type,
      };
      if (component.xml) {
        props.xml = join(MOCK_DEFAULT_OUTPUT, component.xml);
      }
      if (component.content) {
        props.content = join(MOCK_DEFAULT_OUTPUT, component.content);
      }
      converted.push(new SourceComponent(props));
    }
    pkgs?.forEach((pkg) =>
      outputConfigs.push({
        type: 'directory',
        outputDirectory: ensureString(pkg.outputDir),
      })
    );
  }
  const convertStub = $$.SANDBOX.stub(MetadataConverter.prototype, 'convert');
  // Use the successes parameter if provided, but filter out force ignored components
  const baseComponents = options.successes?.getSourceComponents().toArray() ?? (options.merge ? source : converted);
  const notForceIgnoredConverted = baseComponents.filter(
    (component) => component.xml && !(retrievedComponents.forceIgnoredPaths ?? new Set([])).has(component.xml)
  );
  convertStub.resolves({ converted: notForceIgnoredConverted });

  // Stub getPipeline to return a function that resolves
  const mockPipeline = $$.SANDBOX.stub().resolves();
  $$.SANDBOX.stub(streams, 'getPipeline').returns(mockPipeline);

  return {
    retrieveStub,
    checkStatusStub,
    convertStub,
    operation: new MetadataApiRetrieve({
      packageOptions: options.packageOptions,
      usernameOrConnection: connection,
      components: retrievedComponents,
      rootTypesWithDependencies: options.rootTypesWithDependencies,
      output: MOCK_DEFAULT_OUTPUT,
      registry: undefined,
      merge: options.merge,
    }),
    response: retrieveStatus as MetadataApiRetrieveStatus,
  };
}
