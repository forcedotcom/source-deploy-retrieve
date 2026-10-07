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

import { RequestStatus } from '../types';
import { DeployResult } from '../metadataApiDeploy';
import { RetrieveResult } from '../metadataApiRetrieve';
import { TransportContext } from './types';
import { TransportGroup, TransportPipeline, TransportPipelineResult } from './transportPipeline';

type TransportOperation = 'deploy' | 'retrieve';
type TransportResult = DeployResult | RetrieveResult;

export class TransportCoordinator {
  private beforeMetadataResults: TransportPipelineResult = { fileResponses: [], asyncHandles: [] };

  public constructor(
    private readonly pipeline: TransportPipeline,
    private readonly groups: TransportGroup[],
    private readonly context: TransportContext,
    private readonly operation: TransportOperation
  ) {}

  public async runBeforeMetadata(): Promise<void> {
    const result = await this.pipeline.runBeforeMetadata(this.context, this.groups, this.operation);
    this.beforeMetadataResults = result;
  }

  public async processResult(result: TransportResult, status: RequestStatus): Promise<void> {
    if (status !== RequestStatus.Succeeded) return;

    if (this.operation === 'retrieve' && result instanceof RetrieveResult) {
      const extractedByKey = new Map(
        result.components
          .getSourceComponents()
          .toArray()
          .map((component) => [`${component.type.name}#${component.fullName}`, component])
      );
      for (const group of this.groups) {
        group.components = group.components.map(
          (component) => extractedByKey.get(`${component.type.name}#${component.fullName}`) ?? component
        );
      }
    }

    const afterMetadataResults = await this.pipeline.runAfterMetadata(this.context, this.groups, this.operation);
    result.addTransportResults(
      [...this.beforeMetadataResults.fileResponses, ...afterMetadataResults.fileResponses],
      [...this.beforeMetadataResults.asyncHandles, ...afterMetadataResults.asyncHandles]
    );
  }
}
