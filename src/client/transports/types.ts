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

import { Connection, SfProject } from '@salesforce/core';
import { TransportName } from '../../registry/types';
import { SourceComponent } from '../../resolve/sourceComponent';
import { FileResponse, PackageOptions } from '../types';

export type TransportStatus = 'Pending' | 'InProgress' | 'Succeeded' | 'Failed' | 'Unknown';

export type TransportDescription = {
  label: string;
  endpoint: string;
};

export type TransportContext = {
  components: SourceComponent[];
  connection: Connection;
  project: SfProject;
  orgId: string;
  output?: string;
  packageOptions?: PackageOptions;
  /** Package name for each manifest-only transport member (`type#fullName`). */
  transportPackageNames?: Record<string, string>;
};

export type TransportResult = {
  fileResponses: FileResponse[];
  asyncResult?: AsyncTransportHandle;
};

export type AsyncTransportHandle = {
  transportName: TransportName;
  status: TransportStatus;
  message?: string;
  checkStatus(): Promise<AsyncTransportHandle>;
};

export type TransportProvider = {
  readonly name: TransportName;
  describe(): TransportDescription;
  handles(component: SourceComponent): boolean;
  beforeDeploy?(context: TransportContext): Promise<TransportResult>;
  afterDeploy?(context: TransportContext): Promise<TransportResult>;
  beforeRetrieve?(context: TransportContext): Promise<TransportResult>;
  afterRetrieve?(context: TransportContext): Promise<TransportResult>;
};
