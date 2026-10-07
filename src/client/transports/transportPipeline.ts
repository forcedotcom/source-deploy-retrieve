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

import { Lifecycle, Logger, SfError } from '@salesforce/core';
import { SourceComponent } from '../../resolve/sourceComponent';
import { FileResponse } from '../types';
import { AsyncTransportHandle, TransportContext, TransportProvider, TransportResult } from './types';
import { HerokuComputeTransport } from './herokuComputeTransport';

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
  phase: 'before-metadata' | 'metadata-api' | 'after-metadata';
  label: string;
  endpoint: string;
  components: Array<{ fullName: string; type: string }>;
};

export type TransportPipelineResult = {
  fileResponses: FileResponse[];
  asyncHandles: AsyncTransportHandle[];
};

export type TransportStageEvent = {
  transportName: string;
  label: string;
  operation: 'deploy' | 'retrieve';
  stage: 'start' | 'complete' | 'error';
  componentCount: number;
  componentNames: string[];
  errorMessage?: string;
};

export class TransportPipeline {
  private readonly transports: TransportProvider[] = [];
  private readonly logger: Logger;

  public constructor(transports?: TransportProvider[]) {
    this.logger = Logger.childFromRoot('TransportPipeline');
    if (transports) {
      this.transports.push(...transports);
    }
  }

  public static withBuiltinTransports(): TransportPipeline {
    return new TransportPipeline([new HerokuComputeTransport()]);
  }

  public groupByTransport(components: SourceComponent[]): GroupedComponents {
    const metadataApi: SourceComponent[] = [];
    const transportMap = new Map<string, TransportGroup>();

    for (const component of components) {
      const transport = this.findTransportFor(component);
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

  public explain(components: SourceComponent[], operation: 'deploy' | 'retrieve' = 'deploy'): TransportPlan {
    const { metadataApi, transports } = this.groupByTransport(components);
    const phases: TransportPlanPhase[] = [];

    const beforeMetadata = transports.filter((group) => getStep(group.transport, operation, 'before') !== undefined);
    const afterMetadata = transports.filter((group) => getStep(group.transport, operation, 'after') !== undefined);

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
    return this.runTransportGroups(groups, context, operation, 'before');
  }

  public async runAfterMetadata(
    context: TransportContext,
    groups: TransportGroup[],
    operation: 'deploy' | 'retrieve' = 'deploy'
  ): Promise<TransportPipelineResult> {
    return this.runTransportGroups(groups, context, operation, 'after');
  }

  public hasTransports(components: SourceComponent[]): boolean {
    return components.some((component) => this.findTransportFor(component) !== undefined);
  }

  private findTransportFor(component: SourceComponent): TransportProvider | undefined {
    const transportName = component.type.strategies?.transport;
    if (!transportName) return undefined;
    const transport = this.transports.find((candidate) => candidate.name === transportName);
    if (!transport) {
      throw new SfError(
        `No transport provider is registered for '${transportName}' required by ${component.type.name}.`,
        'MissingTransportProvider'
      );
    }
    return transport;
  }

  private async runTransportGroups(
    groups: TransportGroup[],
    context: TransportContext,
    operation: 'deploy' | 'retrieve',
    timing: 'before' | 'after'
  ): Promise<TransportPipelineResult> {
    const allFileResponses: FileResponse[] = [];
    const allAsyncHandles: AsyncTransportHandle[] = [];
    const lifecycle = Lifecycle.getInstance();

    for (const group of groups) {
      const step = getStep(group.transport, operation, timing);
      if (!step) continue;
      this.logger.debug(
        `Running transport '${group.transport.name}' (${operation}) for ${group.components.length} component(s)`
      );

      const desc = group.transport.describe();
      const componentNames = group.components.map((c) => c.fullName);
      const eventBase: Omit<TransportStageEvent, 'stage'> = {
        transportName: group.transport.name,
        label: desc.label,
        operation,
        componentCount: group.components.length,
        componentNames,
      };

      // eslint-disable-next-line no-await-in-loop
      await lifecycle.emit('transportStage', { ...eventBase, stage: 'start' });

      const transportContext: TransportContext = {
        ...context,
        components: group.components,
      };

      try {
        // eslint-disable-next-line no-await-in-loop
        const result: TransportResult = await step(transportContext);
        allFileResponses.push(...result.fileResponses);
        if (result.asyncResult) {
          allAsyncHandles.push(result.asyncResult);
        }
        // eslint-disable-next-line no-await-in-loop
        await lifecycle.emit('transportStage', { ...eventBase, stage: 'complete' });
      } catch (err) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await lifecycle.emit('transportStage', {
            ...eventBase,
            stage: 'error',
            errorMessage: (err as Error).message,
          });
        } catch {
          /* don't mask the transport error */
        }
        throw err;
      }
    }

    return { fileResponses: allFileResponses, asyncHandles: allAsyncHandles };
  }
}

function getStep(
  transport: TransportProvider,
  operation: 'deploy' | 'retrieve',
  timing: 'before' | 'after'
): ((context: TransportContext) => Promise<TransportResult>) | undefined {
  if (operation === 'deploy' && timing === 'before') {
    return transport.beforeDeploy
      ? async (context): Promise<TransportResult> => transport.beforeDeploy!(context)
      : undefined;
  }
  if (operation === 'deploy') {
    return transport.afterDeploy
      ? async (context): Promise<TransportResult> => transport.afterDeploy!(context)
      : undefined;
  }
  if (timing === 'before') {
    return transport.beforeRetrieve
      ? async (context): Promise<TransportResult> => transport.beforeRetrieve!(context)
      : undefined;
  }
  return transport.afterRetrieve
    ? async (context): Promise<TransportResult> => transport.afterRetrieve!(context)
    : undefined;
}
