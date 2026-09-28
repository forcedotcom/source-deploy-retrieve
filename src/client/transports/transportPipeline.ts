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

import { Logger } from '@salesforce/core';
import { SourceComponent } from '../../resolve/sourceComponent';
import { FileResponse } from '../types';
import { AsyncTransportHandle, TransportContext, TransportPhase, TransportProvider, TransportResult } from './types';

export type TransportGroup = {
  transport: TransportProvider;
  components: SourceComponent[];
};

export type GroupedComponents = {
  metadataApi: SourceComponent[];
  transports: TransportGroup[];
};

export type TransportPlan = {
  phases: TransportPlanPhase[];
};

export type TransportPlanPhase = {
  phase: TransportPhase | 'metadata-api';
  label: string;
  endpoint: string;
  components: Array<{ fullName: string; type: string }>;
};

export type TransportPipelineResult = {
  fileResponses: FileResponse[];
  asyncHandles: AsyncTransportHandle[];
};

export class TransportPipeline {
  private readonly transports: TransportProvider[] = [];
  private readonly logger: Logger;

  public constructor() {
    this.logger = Logger.childFromRoot('TransportPipeline');
  }

  public registerTransport(transport: TransportProvider): void {
    this.transports.push(transport);
  }

  public groupByTransport(components: SourceComponent[], skipTypes?: string[]): GroupedComponents {
    const skip = skipTypes ? new Set(skipTypes) : undefined;
    const metadataApi: SourceComponent[] = [];
    const transportMap = new Map<string, TransportGroup>();

    for (const component of components) {
      const transport = this.findTransportFor(component, skip);
      if (transport) {
        let group = transportMap.get(transport.name);
        if (!group) {
          group = { transport, components: [] };
          transportMap.set(transport.name, group);
        }
        group.components.push(component);
      }
      // all components go through metadata api — transport components
      // also have metadata portions (.compute-meta.xml) that need MDAPI
      metadataApi.push(component);
    }

    return {
      metadataApi,
      transports: [...transportMap.values()],
    };
  }

  public explain(
    components: SourceComponent[],
    operation: 'deploy' | 'retrieve' = 'deploy',
    skipTypes?: string[]
  ): TransportPlan {
    const { metadataApi, transports } = this.groupByTransport(components, skipTypes);
    const phases: TransportPlanPhase[] = [];

    const beforeMetadata = transports.filter((g) => g.transport.phase[operation] === 'before-metadata');
    const afterMetadata = transports.filter((g) => g.transport.phase[operation] === 'after-metadata');

    for (const group of beforeMetadata) {
      const desc = group.transport.describe();
      phases.push({
        phase: 'before-metadata',
        label: desc.label,
        endpoint: desc.endpoint,
        components: group.components.map((c) => ({ fullName: c.fullName, type: c.type.name })),
      });
    }

    phases.push({
      phase: 'metadata-api',
      label: 'Metadata API',
      endpoint: 'SOAP/REST',
      components: metadataApi.map((c) => ({ fullName: c.fullName, type: c.type.name })),
    });

    for (const group of afterMetadata) {
      const desc = group.transport.describe();
      phases.push({
        phase: 'after-metadata',
        label: desc.label,
        endpoint: desc.endpoint,
        components: group.components.map((c) => ({ fullName: c.fullName, type: c.type.name })),
      });
    }

    return { phases };
  }

  public async runBeforeMetadata(
    context: TransportContext,
    groups: TransportGroup[],
    operation: 'deploy' | 'retrieve' = 'deploy'
  ): Promise<TransportPipelineResult> {
    const beforeMetadata = groups.filter((g) => g.transport.phase[operation] === 'before-metadata');
    return this.runTransportGroups(beforeMetadata, context, operation);
  }

  public async runAfterMetadata(
    context: TransportContext,
    groups: TransportGroup[],
    operation: 'deploy' | 'retrieve' = 'deploy'
  ): Promise<TransportPipelineResult> {
    const afterMetadata = groups.filter((g) => g.transport.phase[operation] === 'after-metadata');
    return this.runTransportGroups(afterMetadata, context, operation);
  }

  public hasTransports(components: SourceComponent[], skipTypes?: string[]): boolean {
    const skip = skipTypes ? new Set(skipTypes) : undefined;
    return components.some((c) => this.findTransportFor(c, skip) !== undefined);
  }

  private findTransportFor(component: SourceComponent, skipTypes?: Set<string>): TransportProvider | undefined {
    if (skipTypes?.has(component.type.name)) {
      return undefined;
    }
    return this.transports.find((t) => t.handles(component));
  }

  private async runTransportGroups(
    groups: TransportGroup[],
    context: TransportContext,
    operation: 'deploy' | 'retrieve'
  ): Promise<TransportPipelineResult> {
    const allFileResponses: FileResponse[] = [];
    const allAsyncHandles: AsyncTransportHandle[] = [];

    for (const group of groups) {
      this.logger.debug(
        `Running transport '${group.transport.name}' (${operation}) for ${group.components.length} component(s)`
      );

      const transportContext: TransportContext = {
        ...context,
        components: group.components,
      };

      // eslint-disable-next-line no-await-in-loop
      const result: TransportResult = await group.transport[operation](transportContext);
      allFileResponses.push(...result.fileResponses);
      if (result.asyncResult) {
        allAsyncHandles.push(result.asyncResult);
      }
    }

    return { fileResponses: allFileResponses, asyncHandles: allAsyncHandles };
  }
}
