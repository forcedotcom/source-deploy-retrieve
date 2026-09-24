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
import { SourceComponent } from '../../resolve/sourceComponent';
import { FileResponse } from '../types';

export type TransportPhase = 'before-metadata' | 'after-metadata';

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
};

export type TransportResult = {
  fileResponses: FileResponse[];
  asyncResult?: AsyncTransportHandle;
};

export type AsyncTransportHandle = {
  transportName: string;
  status: TransportStatus;
  message?: string;
  checkStatus(): Promise<AsyncTransportHandle>;
};

export type TransportProvider = {
  readonly name: string;
  readonly phase: {
    deploy: TransportPhase;
    retrieve: TransportPhase;
  };
  describe(): TransportDescription;
  handles(component: SourceComponent): boolean;
  deploy(context: TransportContext): Promise<TransportResult>;
  retrieve(context: TransportContext): Promise<TransportResult>;
};
