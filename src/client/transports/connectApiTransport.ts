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

import { dirname } from 'node:path';
import FormData from 'form-data';
import { Logger, SfError } from '@salesforce/core';
import type { Connection } from '@salesforce/core';
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

function resolveAppDir(component: SourceComponent): string {
  if (component.content) {
    return component.content;
  }
  if (component.xml) {
    return dirname(component.xml);
  }
  throw new SfError(`PlatformComputeApp '${component.fullName}' has no content or xml path`, 'MissingComponentPath');
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

  try {
    return await connection.request<ComputeSourceUploadResponse>({
      method: 'POST',
      url: ENDPOINT,
      body: form,
      headers: form.getHeaders(),
    });
  } catch (err) {
    throw new SfError(`Connect API upload failed for '${name}': ${(err as Error).message}`, 'ConnectApiUploadError');
  }
}

// jsforce decodes to UTF-8 by default — lossy for gzip bytes.
// encoding: 'binary' (latin1) preserves byte values 1:1.
async function downloadSource(connection: Connection, appIdOrName: string): Promise<Buffer> {
  try {
    const body = await connection.request<string>(
      { method: 'GET', url: `/connect/compute/${encodeURIComponent(appIdOrName)}/source` },
      { encoding: 'binary' }
    );
    return Buffer.from(body, 'binary');
  } catch (err) {
    throw new SfError(
      `Connect API download failed for '${appIdOrName}': ${(err as Error).message}`,
      'ConnectApiDownloadError'
    );
  }
}

export class ConnectApiTransport implements TransportProvider {
  public readonly name = 'connectApi';
  public readonly phase = { deploy: 'before-metadata' as const, retrieve: 'after-metadata' as const };
  private readonly logger = Logger.childFromRoot('ConnectApiTransport');

  // eslint-disable-next-line class-methods-use-this
  public describe(): TransportDescription {
    return { label: 'Heroku Compute (Connect API)', endpoint: ENDPOINT };
  }

  // eslint-disable-next-line class-methods-use-this
  public handles(component: SourceComponent): boolean {
    return component.type.strategies?.transport === 'connectApi' || component.type.name === 'PlatformComputeApp';
  }

  public async deploy(context: TransportContext): Promise<TransportResult> {
    validateApiVersion(context.connection);
    const fileResponses: FileResponse[] = [];

    for (const component of context.components) {
      const appDir = resolveAppDir(component);
      this.logger.debug('deploying compute source for %s from %s', component.fullName, appDir);

      // eslint-disable-next-line no-await-in-loop
      const bundle = await packageComputeBundle(appDir, component.fullName);
      this.logger.debug('packaged %s: %d bytes, %d files', component.fullName, bundle.buffer.length, bundle.fileCount);

      // eslint-disable-next-line no-await-in-loop
      const result = await uploadSource(context.connection, component.fullName, bundle.buffer);
      this.logger.debug('uploaded %s: buildId=%s', component.fullName, result.buildId);

      fileResponses.push({
        fullName: component.fullName,
        type: component.type.name,
        state: ComponentStatus.Changed,
        filePath: appDir,
      });
    }

    return { fileResponses };
  }

  public async retrieve(context: TransportContext): Promise<TransportResult> {
    validateApiVersion(context.connection);
    const fileResponses: FileResponse[] = [];

    for (const component of context.components) {
      const appDir = resolveAppDir(component);
      this.logger.debug('retrieving compute source for %s into %s', component.fullName, appDir);

      // eslint-disable-next-line no-await-in-loop
      const buffer = await downloadSource(context.connection, component.fullName);
      // eslint-disable-next-line no-await-in-loop
      const unpacked = await unpackComputeBundle(buffer, appDir);
      this.logger.debug('unpacked %s: %d files into %s', component.fullName, unpacked.fileCount, appDir);

      fileResponses.push({
        fullName: component.fullName,
        type: component.type.name,
        state: ComponentStatus.Changed,
        filePath: appDir,
      });
    }

    return { fileResponses };
  }
}
