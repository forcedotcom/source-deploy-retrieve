/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { PollingClient } from '@salesforce/core';
import { testSetup } from '@salesforce/core/lib/testSetup';
import { join, sep } from 'path';
import { match, SinonSandbox, SinonSpy, SinonStub } from 'sinon';
import { createMockZip, mockConnection } from '.';
import {
  ComponentSet,
  ConvertOutputConfig,
  MetadataConverter,
  RetrieveMessage,
  SourceComponent,
  MetadataApiDeploy,
  MetadataApiRetrieve,
} from '../../../src';
import { DeployResultLocator, AsyncResult } from 'jsforce';
import {
  DeployMessage,
  MetadataApiDeployStatus,
  FileProperties,
  MetadataApiDeployOptions,
  RequestStatus,
  MetadataApiRetrieveStatus,
  PackageOption,
} from '../../../src/client/types';
import { ComponentProperties } from '../../../src/resolve/sourceComponent';
import { normalizeToArray } from '../../../src/utils';
import { mockRegistry } from '../registry';

export const MOCK_ASYNC_RESULT = { id: '1234', state: RequestStatus.Pending, done: false };
export const MOCK_DEFAULT_OUTPUT = sep + 'test';
export const MOCK_RECENTLY_VALIDATED_ID_REST = { id: '1234567890' };
export const MOCK_RECENTLY_VALIDATED_ID_SOAP = '0987654321';

interface DeployStubOptions {
  components?: ComponentSet;
  componentSuccesses?: Partial<DeployMessage> | Partial<DeployMessage>[];
  componentFailures?: Partial<DeployMessage> | Partial<DeployMessage>[];
  apiOptions?: MetadataApiDeployOptions;
  id?: string;
}

interface DeployOperationLifecycle {
  pollingClientSpy: SinonSpy;
  deployStub: SinonStub;
  convertStub: SinonStub;
  checkStatusStub: SinonStub;
  deployRecentlyValidatedIdStub: SinonStub;
  invokeStub: SinonStub;
  invokeResultStub: SinonStub;
  operation: MetadataApiDeploy;
  response: MetadataApiDeployStatus;
}

export async function stubMetadataDeploy(
  sandbox: SinonSandbox,
  options: DeployStubOptions = { components: new ComponentSet() }
): Promise<DeployOperationLifecycle> {
  const zipBuffer = Buffer.from('1234');
  const connection = await mockConnection(testSetup());

  const deployStub = sandbox.stub(connection, 'deploy');
  const pollingClientSpy = sandbox.spy(PollingClient, 'create');

  deployStub
    .withArgs(zipBuffer, options.apiOptions ?? MetadataApiDeploy.DEFAULT_OPTIONS.apiOptions)
    // overriding return type to match API
    .resolves((MOCK_ASYNC_RESULT as unknown) as DeployResultLocator<AsyncResult>);

  const deployRecentlyValidatedIdStub = sandbox.stub(connection, 'deployRecentValidation');
  deployRecentlyValidatedIdStub
    .withArgs({ id: MOCK_ASYNC_RESULT.id, rest: true })
    .resolves(MOCK_RECENTLY_VALIDATED_ID_REST)
    .withArgs({ id: MOCK_ASYNC_RESULT.id, rest: false })
    // @ts-ignore overriding return type to match API
    .resolves(MOCK_RECENTLY_VALIDATED_ID_SOAP);

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
  status.done = true;
  const checkStatusStub = sandbox.stub(connection.metadata, 'checkDeployStatus');
  // @ts-ignore
  checkStatusStub.withArgs(MOCK_ASYNC_RESULT.id, true).resolves(status);

  // @ts-ignore
  const invokeStub = sandbox.stub(connection.metadata, '_invoke');
  const invokeResultStub = sandbox.stub();
  invokeStub.returns({
    thenCall: (f: (result: any | null) => void) => {
      return f(invokeResultStub());
    },
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
    }),
    response: status as MetadataApiDeployStatus,
  };
}

interface RetrieveStubOptions {
  merge?: boolean;
  packageOptions?: string[] | PackageOption[];
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
  const { toRetrieve: retrievedComponents, packageOptions: packages } = options;
  const connection = await mockConnection(testSetup());

  const retrieveStub = sandbox.stub(connection.metadata, 'retrieve').resolves(MOCK_ASYNC_RESULT);

  const retrieveStatus: Partial<MetadataApiRetrieveStatus> = {
    id: MOCK_ASYNC_RESULT.id,
    status: RequestStatus.Pending,
    success: false,
    done: true,
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

  const source = retrievedComponents.getSourceComponents().toArray();

  const outputConfigs: ConvertOutputConfig[] = [];
  let converted: SourceComponent[] = [];
  let pkgs: PackageOption[];

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
    });
    converted = source;

    pkgs?.forEach((pkg) =>
      outputConfigs.push({
        type: 'merge',
        mergeWith: retrievedComponents.getSourceComponents(),
        defaultDirectory: pkg.outputDir,
      })
    );
  } else {
    outputConfigs.push({
      type: 'directory',
      outputDirectory: MOCK_DEFAULT_OUTPUT,
    });
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
    pkgs?.forEach((pkg) =>
      outputConfigs.push({
        type: 'directory',
        outputDirectory: pkg.outputDir,
      })
    );
  }
  const convertStub = sandbox.stub(MetadataConverter.prototype, 'convert');
  outputConfigs.forEach((outputCfg) => {
    convertStub.withArgs(match.any, 'source', outputCfg).resolves({ converted });
  });

  return {
    retrieveStub,
    checkStatusStub,
    convertStub,
    operation: new MetadataApiRetrieve({
      packageOptions: options.packageOptions,
      usernameOrConnection: connection,
      components: retrievedComponents,
      output: MOCK_DEFAULT_OUTPUT,
      registry: mockRegistry,
      merge: options.merge,
    }),
    response: retrieveStatus as MetadataApiRetrieveStatus,
  };
}
