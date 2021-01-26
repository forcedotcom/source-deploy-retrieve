/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { testSetup } from '@salesforce/core/lib/testSetup';
import { Done } from 'mocha';
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
import { MetadataApiDeploy, MetadataApiRetrieve } from '../../../src/client/metadataOperatitons';
import {
  DeployMessage,
  DeployResult,
  FileProperties,
  RequestStatus,
  RetrieveResult,
} from '../../../src/client/types';
import { mockRegistry } from '../registry';
import { KEANU_COMPONENT } from '../registry/keanuConstants';

abstract class MetadataOperationMock {
  constructor(protected sandbox: SinonSandbox, private done: Done) {}

  public validate(logic: () => void): void {
    let fail: Error;
    try {
      logic();
    } catch (e) {
      fail = e;
    }
    this.sandbox.restore();
    this.done(fail);
  }

  public abstract stub(options: any): Promise<any>;
}

interface DeployStubOptions {
  components?: ComponentSet;
  componentSuccesses?: Partial<DeployMessage> | Partial<DeployMessage>[];
  componentFailures?: Partial<DeployMessage> | Partial<DeployMessage>[];
}

interface DeployOperationLifecycle {
  deployStub: SinonStub;
  convertStub: SinonStub;
  checkStatusStub: SinonStub;
  invokeStub: SinonStub;
  operation: MetadataApiDeploy;
}

export class MetadataApiDeployMock extends MetadataOperationMock {
  public readonly asyncResult = { id: '1234', state: RequestStatus.Pending, done: false };

  public async stub(
    options: DeployStubOptions = { components: new ComponentSet() }
  ): Promise<DeployOperationLifecycle> {
    const zipBuffer = Buffer.from('1234');
    const connection = await mockConnection(testSetup());

    const deployStub = this.sandbox.stub(connection.metadata, 'deploy');
    deployStub.withArgs(zipBuffer, MetadataApiDeploy.DEFAULT_OPTIONS).resolves(this.asyncResult);

    const convertStub = this.sandbox.stub(MetadataConverter.prototype, 'convert');
    convertStub
      .withArgs(Array.from(options.components), 'metadata', { type: 'zip' })
      .resolves({ zipBuffer });

    const defaultStatus = { success: false, done: false, status: RequestStatus.Pending };
    const status: Partial<DeployResult> = Object.assign(defaultStatus, this.asyncResult);
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
    const checkStatusStub = this.sandbox.stub(connection.metadata, 'checkDeployStatus');
    // @ts-ignore
    checkStatusStub.withArgs(this.asyncResult.id, true).resolves(status);

    // @ts-ignore
    const invokeStub = this.sandbox.stub(connection.metadata, '_invoke');

    return {
      deployStub,
      convertStub,
      checkStatusStub,
      invokeStub,
      operation: new MetadataApiDeploy({
        connection,
        components: options.components,
      }),
    };
  }
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
}

export class MetadataApiRetrieveMock extends MetadataOperationMock {
  public readonly asyncResult = { id: '1234', state: RequestStatus.Pending, done: false };
  public readonly defaultOutput = sep + 'test';

  public async stub(options: RetrieveStubOptions): Promise<RetrieveOperationLifecycle> {
    const connection = await mockConnection(testSetup());
    const { components } = options;
    // contents of the zip don't really matter (unless something changes)
    const zipBuffer = await createMockZip([
      'unpackaged/package.xml',
      join('unpackaged', KEANU_COMPONENT.content),
      join('unpackaged', KEANU_COMPONENT.xml),
    ]);

    const retrieveStub = this.sandbox.stub(connection.metadata, 'retrieve');
    retrieveStub
      // @ts-ignore required callback
      .withArgs({
        apiVersion: components.apiVersion,
        unpackaged: components.getObject().Package,
      })
      .resolves(this.asyncResult);

    const defaultStatus: Partial<RetrieveResult> = {
      id: this.asyncResult.id,
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
    const checkStatusStub = this.sandbox.stub(connection.metadata, 'checkRetrieveStatus');
    // @ts-ignore force returning project's RetrieveResult type
    checkStatusStub.withArgs(this.asyncResult.id).resolves(defaultStatus);

    const source = Array.from(components.getSourceComponents());

    let outputConfig: ConvertOutputConfig;
    let converted: SourceComponent[] = [];
    if (options.merge) {
      outputConfig = {
        type: 'merge',
        mergeWith: components.getSourceComponents(),
        defaultDirectory: this.defaultOutput,
      };
      converted = source;
    } else {
      outputConfig = {
        type: 'directory',
        outputDirectory: this.defaultOutput,
      };
      for (const component of components) {
        const sc = new SourceComponent({
          name: component.fullName,
          type: component.type,
          xml: join(this.defaultOutput, `${component.fullName}.${component.type.suffix}-meta.xml`),
          content: join(this.defaultOutput, `${component.fullName}.${component.type.suffix}`),
        });
        converted.push(sc);
      }
    }
    const convertStub = this.sandbox.stub(MetadataConverter.prototype, 'convert');
    convertStub.withArgs(match.any, 'source', outputConfig).resolves({ converted });

    return {
      retrieveStub,
      checkStatusStub,
      convertStub,
      operation: new MetadataApiRetrieve({
        connection,
        components,
        defaultOutput: this.defaultOutput,
        registry: mockRegistry,
        merge: options.merge,
      }),
    };
  }
}
