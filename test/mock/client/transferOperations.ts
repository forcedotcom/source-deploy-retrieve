/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { testSetup } from '@salesforce/core/lib/testSetup';
import { join, sep } from 'path';
import { match, SinonSandbox, SinonStub } from 'sinon';
import { createMockZip, mockConnection } from '.';
import {
  ComponentSet,
  ConvertOutputConfig,
  MetadataConverter,
  RetrieveMessage,
  SourceComponent,
} from '../../../src';
import { MetadataApiDeploy, MetadataApiRetrieve } from '../../../src/client';
import {
  DeployMessage,
  DeployResult,
  FileProperties,
  MetadataApiDeployOptions,
  RequestStatus,
  MetadataApiRetrieveStatus,
} from '../../../src/client/types';
import { mockRegistry } from '../registry';
import { COMPONENT } from '../registry/matchingContentFileConstants';

export const MOCK_ASYNC_RESULT = { id: '1234', state: RequestStatus.Pending, done: false };
export const MOCK_DEFAULT_OUTPUT = sep + 'test';

interface DeployStubOptions {
  components?: ComponentSet;
  componentSuccesses?: Partial<DeployMessage> | Partial<DeployMessage>[];
  componentFailures?: Partial<DeployMessage> | Partial<DeployMessage>[];
  apiOptions?: MetadataApiDeployOptions;
}

interface DeployOperationLifecycle {
  deployStub: SinonStub;
  convertStub: SinonStub;
  checkStatusStub: SinonStub;
  invokeStub: SinonStub;
  operation: MetadataApiDeploy;
}

export async function stubMetadataDeploy(
  sandbox: SinonSandbox,
  options: DeployStubOptions = { components: new ComponentSet() }
): Promise<DeployOperationLifecycle> {
  const zipBuffer = Buffer.from('1234');
  const connection = await mockConnection(testSetup());

  const deployStub = sandbox.stub(connection.metadata, 'deploy');
  deployStub
    .withArgs(zipBuffer, options.apiOptions ?? MetadataApiDeploy.DEFAULT_OPTIONS.apiOptions)
    .resolves(MOCK_ASYNC_RESULT);

  const convertStub = sandbox.stub(MetadataConverter.prototype, 'convert');
  convertStub
    .withArgs(Array.from(options.components), 'metadata', { type: 'zip' })
    .resolves({ zipBuffer });

  const defaultStatus = { success: false, done: false, status: RequestStatus.Pending };
  const status: Partial<DeployResult> = Object.assign(defaultStatus, MOCK_ASYNC_RESULT);
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
  const checkStatusStub = sandbox.stub(connection.metadata, 'checkDeployStatus');
  // @ts-ignore
  checkStatusStub.withArgs(MOCK_ASYNC_RESULT.id, true).resolves(status);

  // @ts-ignore
  const invokeStub = sandbox.stub(connection.metadata, '_invoke');

  return {
    deployStub,
    convertStub,
    checkStatusStub,
    invokeStub,
    operation: new MetadataApiDeploy({
      usernameOrConnection: connection,
      components: options.components,
    }),
  };
}

interface RetrieveStubOptions {
  merge?: boolean;
  components?: ComponentSet;
  successes?: ComponentSet;
  messages?: Partial<RetrieveMessage> | Partial<RetrieveMessage>[];
  fileProperties?: Partial<FileProperties> | Partial<FileProperties>[];
  failures?: ComponentSet;
}

interface RetrieveOperationLifecycle {
  retrieveStub: SinonStub;
  checkStatusStub: SinonStub;
  convertStub: SinonStub;
  operation: MetadataApiRetrieve;
  response: MetadataApiRetrieveStatus;
}

export async function stubMetadataRetrieve(
  sandbox: SinonSandbox,
  options: RetrieveStubOptions
): Promise<RetrieveOperationLifecycle> {
  const connection = await mockConnection(testSetup());
  const { components } = options;
  // contents of the zip don't really matter (unless something changes)
  const zipBuffer = await createMockZip([
    'unpackaged/package.xml',
    join('unpackaged', COMPONENT.content),
    join('unpackaged', COMPONENT.xml),
  ]);

  const retrieveStub = sandbox.stub(connection.metadata, 'retrieve');
  retrieveStub
    // @ts-ignore required callback
    .withArgs({
      apiVersion: components.apiVersion,
      unpackaged: components.getObject().Package,
    })
    .resolves(MOCK_ASYNC_RESULT);

  const defaultStatus: Partial<MetadataApiRetrieveStatus> = {
    id: MOCK_ASYNC_RESULT.id,
    status: RequestStatus.Pending,
    success: false,
    done: false,
    zipFile: zipBuffer.toString('base64'),
  };
  if (options.fileProperties) {
    defaultStatus.success = true;
    // @ts-ignore
    defaultStatus.fileProperties = options.fileProperties;
    defaultStatus.status = options.failures
      ? RequestStatus.SucceededPartial
      : RequestStatus.Succeeded;
  } else {
    defaultStatus.success = false;
    defaultStatus.status = RequestStatus.Failed;
  }
  if (options.messages) {
    // @ts-ignore
    defaultStatus.messages = options.messages;
  }
  const checkStatusStub = sandbox.stub(connection.metadata, 'checkRetrieveStatus');
  // @ts-ignore force returning project's RetrieveResult type
  checkStatusStub.withArgs(MOCK_ASYNC_RESULT.id).resolves(defaultStatus);

  const source = Array.from(components.getSourceComponents());

  let outputConfig: ConvertOutputConfig;
  let converted: SourceComponent[] = [];
  if (options.merge) {
    outputConfig = {
      type: 'merge',
      mergeWith: components.getSourceComponents(),
      defaultDirectory: MOCK_DEFAULT_OUTPUT,
    };
    converted = source;
  } else {
    outputConfig = {
      type: 'directory',
      outputDirectory: MOCK_DEFAULT_OUTPUT,
    };
    for (const component of components) {
      const sc = new SourceComponent({
        name: component.fullName,
        type: component.type,
        xml: join(MOCK_DEFAULT_OUTPUT, `${component.fullName}.${component.type.suffix}-meta.xml`),
        content: join(MOCK_DEFAULT_OUTPUT, `${component.fullName}.${component.type.suffix}`),
      });
      converted.push(sc);
    }
  }
  const convertStub = sandbox.stub(MetadataConverter.prototype, 'convert');
  convertStub.withArgs(match.any, 'source', outputConfig).resolves({ converted });

  return {
    retrieveStub,
    checkStatusStub,
    convertStub,
    operation: new MetadataApiRetrieve({
      usernameOrConnection: connection,
      components,
      output: MOCK_DEFAULT_OUTPUT,
      registry: mockRegistry,
      merge: options.merge,
    }),
    response: defaultStatus as MetadataApiRetrieveStatus,
  };
}
