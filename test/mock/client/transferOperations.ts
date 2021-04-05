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
  MetadataApiDeployStatus,
  FileProperties,
  MetadataApiDeployOptions,
  RequestStatus,
  MetadataApiRetrieveStatus,
} from '../../../src/client/types';
import { ComponentProperties } from '../../../src/resolve/sourceComponent';
import { normalizeToArray } from '../../../src/utils';
import { mockRegistry } from '../registry';

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
  response: MetadataApiDeployStatus;
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
    response: status as MetadataApiDeployStatus,
  };
}

interface RetrieveStubOptions {
  merge?: boolean;
  packageNames?: string[];
  toRetrieve?: ComponentSet;
  messages?: Partial<RetrieveMessage> | Partial<RetrieveMessage>[];
  successes?: ComponentSet;
}

interface RetrieveOperationLifecycle {
  retrieveStub: SinonStub;
  checkStatusStub: SinonStub;
  convertStub: SinonStub;
  operation: MetadataApiRetrieve;
  response: MetadataApiRetrieveStatus;
}

/**
 * A stubber that simulates the API retrieve.
 *
 * @param sandbox Sinon sandbox to stub against
 * @param options Options to stub out the retrieve
 */
export async function stubMetadataRetrieve(
  sandbox: SinonSandbox,
  options: RetrieveStubOptions
): Promise<RetrieveOperationLifecycle> {
  const { toRetrieve: components } = options;
  const connection = await mockConnection(testSetup());

  const retrieveStub = sandbox.stub(connection.metadata, 'retrieve').resolves(MOCK_ASYNC_RESULT);

  const retrieveStatus: Partial<MetadataApiRetrieveStatus> = {
    id: MOCK_ASYNC_RESULT.id,
    status: RequestStatus.Pending,
    success: false,
    done: false,
  };

  const zipEntries = ['unpackaged/package.xml'];

  const successes = options.successes?.getSourceComponents().toArray();

  if (successes?.length > 0) {
    retrieveStatus.success = true;
    retrieveStatus.status = RequestStatus.Succeeded;
    const fileProperties: Partial<FileProperties>[] = [];

    for (const success of successes) {
      const contentFiles = success.walkContent();
      if (contentFiles.length > 0) {
        for (const content of success.walkContent()) {
          fileProperties.push({
            fullName: success.fullName,
            type: success.type.name,
            fileName: content,
          });
          zipEntries.push(join('unpackaged', content));
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
      fileProperties.length === 1
        ? (fileProperties[0] as FileProperties)
        : (fileProperties as FileProperties[]);
  }

  const messages = normalizeToArray(options.messages);

  if (messages.length > 0) {
    retrieveStatus.status =
      retrieveStatus.status === RequestStatus.Succeeded
        ? RequestStatus.SucceededPartial
        : RequestStatus.Failed;
    retrieveStatus.messages =
      messages.length === 1 ? (messages[0] as RetrieveMessage) : (messages as RetrieveMessage[]);
  }

  retrieveStatus.zipFile = (await createMockZip(zipEntries)).toString('base64');

  const checkStatusStub = sandbox.stub(connection.metadata, 'checkRetrieveStatus');
  // @ts-ignore force returning project's RetrieveResult type
  checkStatusStub.withArgs(MOCK_ASYNC_RESULT.id).resolves(retrieveStatus);

  const source = components.getSourceComponents().toArray();

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
    if (options.successes) {
      for (const component of successes) {
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
    }
  }
  const convertStub = sandbox.stub(MetadataConverter.prototype, 'convert');
  convertStub.withArgs(match.any, 'source', outputConfig).resolves({ converted });

  return {
    retrieveStub,
    checkStatusStub,
    convertStub,
    operation: new MetadataApiRetrieve({
      packageNames: options.packageNames,
      usernameOrConnection: connection,
      components,
      output: MOCK_DEFAULT_OUTPUT,
      registry: mockRegistry,
      merge: options.merge,
    }),
    response: retrieveStatus as MetadataApiRetrieveStatus,
  };
}
