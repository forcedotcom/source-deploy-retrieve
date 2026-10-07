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

import { join } from 'node:path';
import FormData from 'form-data';
import { Logger, SfError } from '@salesforce/core';
import type { Connection, SfProject } from '@salesforce/core';
import { DEFAULT_PACKAGE_ROOT_SFDX } from '../../common/constants';
import { SourceComponent } from '../../resolve/sourceComponent';
import { ComponentStatus, FileResponse } from '../types';
import { TransportContext, TransportDescription, TransportProvider, TransportResult } from './types';
import { packageComputeBundle, unpackComputeBundle } from './computeSourceBundle';

type ComputeSourceUploadResponse = {
  platformComputeId: string;
  buildId: string;
  sourceBlobSize: number;
  uploadedAt: string;
};

const MIN_API_VERSION = '68.0';
const ENDPOINT = '/connect/compute/source';

function resolveContentPath(component: SourceComponent, project: SfProject): string {
  const packageDir = project.getDefaultPackage().fullPath;
  return join(packageDir, DEFAULT_PACKAGE_ROOT_SFDX, component.type.directoryName, component.fullName);
}

function validateApiVersion(connection: Connection): void {
  const version = connection.version;
  if (!version || parseFloat(version) < parseFloat(MIN_API_VERSION)) {
    throw new SfError(
      `PlatformComputeApp requires API version ${MIN_API_VERSION} or later (current: ${version ?? 'unknown'})`,
      'InsufficientApiVersion'
    );
  }
}

async function uploadSource(
  connection: Connection,
  name: string,
  bundle: Buffer
): Promise<ComputeSourceUploadResponse> {
  const form = new FormData();
  form.append('name', name);
  form.append('bundle', bundle, {
    filename: 'deployment-bundle.tar.gz',
    contentType: 'application/gzip',
  });

  return connection.request<ComputeSourceUploadResponse>({
    method: 'POST',
    url: ENDPOINT,
    body: form.getBuffer(),
    headers: form.getHeaders(),
  });
}

// jsforce decodes to UTF-8 by default — lossy for gzip bytes.
// encoding: 'binary' (latin1) preserves byte values 1:1.
async function downloadSource(connection: Connection, appIdOrName: string): Promise<Buffer> {
  const body = await connection.request<string>(
    { method: 'GET', url: `/connect/compute/${encodeURIComponent(appIdOrName)}/source` },
    { encoding: 'binary' }
  );
  return Buffer.from(body, 'binary');
}

export class HerokuComputeTransport implements TransportProvider {
  public readonly name = 'herokuCompute';
  public readonly phase = { deploy: 'before-metadata' as const, retrieve: 'after-metadata' as const };
  private readonly logger = Logger.childFromRoot('HerokuComputeTransport');

  // eslint-disable-next-line class-methods-use-this
  public describe(): TransportDescription {
    return { label: 'Heroku Compute', endpoint: ENDPOINT };
  }

  // eslint-disable-next-line class-methods-use-this
  public handles(component: SourceComponent): boolean {
    return component.type.strategies?.transport === 'herokuCompute' || component.type.name === 'PlatformComputeApp';
  }

  public async deploy(context: TransportContext): Promise<TransportResult> {
    validateApiVersion(context.connection);
    const fileResponses: FileResponse[] = [];

    for (const component of context.components) {
      try {
        this.assertComputeComponent(component);
        this.logger.debug('deploying compute source for %s from %s', component.fullName, component.content);

        // eslint-disable-next-line no-await-in-loop
        const bundle = await packageComputeBundle(component.content, component.fullName);
        this.logger.debug(
          'packaged %s: %d bytes, %d files',
          component.fullName,
          bundle.buffer.length,
          bundle.fileCount
        );

        // eslint-disable-next-line no-await-in-loop
        const result = await uploadSource(context.connection, component.fullName, bundle.buffer);
        this.logger.debug('uploaded %s: buildId=%s', component.fullName, result.buildId);

        fileResponses.push({
          fullName: component.fullName,
          type: component.type.name,
          state: ComponentStatus.Changed,
          filePath: component.content,
        });
      } catch (err) {
        fileResponses.push({
          fullName: component.fullName,
          type: component.type.name,
          state: ComponentStatus.Failed,
          filePath: component.content ?? component.xml ?? '',
          error: `Heroku Compute upload failed for '${component.fullName}': ${(err as Error).message}`,
          problemType: 'Error',
        });
      }
    }

    return this.checkForFailures(fileResponses, 'upload');
  }

  public async retrieve(context: TransportContext): Promise<TransportResult> {
    validateApiVersion(context.connection);
    const fileResponses: FileResponse[] = [];

    for (const component of context.components) {
      try {
        const contentPath = component.content ?? resolveContentPath(component, context.project);
        this.logger.debug('retrieving compute source for %s into %s', component.fullName, contentPath);

        // eslint-disable-next-line no-await-in-loop
        const buffer = await downloadSource(context.connection, component.fullName);
        // eslint-disable-next-line no-await-in-loop
        const unpacked = await unpackComputeBundle(buffer, contentPath);
        this.logger.debug('unpacked %s: %d files into %s', component.fullName, unpacked.fileCount, contentPath);

        fileResponses.push({
          fullName: component.fullName,
          type: component.type.name,
          state: ComponentStatus.Changed,
          filePath: contentPath,
        });
      } catch (err) {
        fileResponses.push({
          fullName: component.fullName,
          type: component.type.name,
          state: ComponentStatus.Failed,
          filePath: component.content ?? component.xml ?? '',
          error: `Heroku Compute download failed for '${component.fullName}': ${(err as Error).message}`,
          problemType: 'Error',
        });
      }
    }

    return this.checkForFailures(fileResponses, 'download');
  }

  // eslint-disable-next-line class-methods-use-this
  private assertComputeComponent(
    component: SourceComponent
  ): asserts component is SourceComponent & { content: string } {
    if (!component.content) {
      throw new SfError(
        `HerokuComputeTransport requires a content path for '${component.fullName}'`,
        'MissingComponentContent'
      );
    }
  }

  // eslint-disable-next-line class-methods-use-this
  private checkForFailures(fileResponses: FileResponse[], operation: string): TransportResult {
    const failures = fileResponses.filter((r) => r.state === ComponentStatus.Failed);
    if (failures.length > 0) {
      const details = failures.map((f) => f.error ?? f.fullName).join('; ');
      const error = new SfError(
        `Heroku Compute ${operation} failed: ${details}`,
        `HerokuCompute${operation.charAt(0).toUpperCase() + operation.slice(1)}Error`
      );
      error.data = fileResponses;
      throw error;
    }

    return { fileResponses };
  }
}
