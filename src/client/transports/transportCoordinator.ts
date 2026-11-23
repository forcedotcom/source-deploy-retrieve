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
import { ComponentSet } from '../../collections/componentSet';
import { RequestStatus } from '../types';
import { DeployResult } from '../metadataApiDeploy';
import { RetrieveResult } from '../metadataApiRetrieve';
import type { SourceComponent } from '../../resolve/sourceComponent';
import { TransportContext } from './types';
import { TransportGroup, TransportPipeline, TransportPipelineResult } from './transportPipeline';

type TransportOperation = 'deploy' | 'retrieve';
type TransportResult = DeployResult | RetrieveResult;

export class TransportCoordinator {
  private beforeMetadataResults: TransportPipelineResult = {
    fileResponses: [],
    asyncHandles: [],
    operationResults: [],
  };
  private readonly beforeAdded = new WeakSet<TransportResult>();
  private readonly afterStarted = new WeakSet<TransportResult>();

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
    if (!this.beforeAdded.has(result)) {
      this.beforeAdded.add(result);
      result.addTransportResults(
        this.beforeMetadataResults.fileResponses,
        this.beforeMetadataResults.asyncHandles,
        this.beforeMetadataResults.operationResults
      );
    }
    if (status !== RequestStatus.Succeeded) return;
    if (this.afterStarted.has(result)) return;
    this.afterStarted.add(result);

    if (this.operation === 'retrieve' && result instanceof RetrieveResult) {
      const extracted = result.components.getSourceComponents().toArray();
      const keyOf = (component: SourceComponent): string => `${component.type.name}#${component.fullName}`;
      const extractedByKey = new Map(extracted.map((component) => [keyOf(component), component]));
      // the org that owns a namespace returns its components unprefixed (with no
      // namespacePrefix in fileProperties), so a request for `ns__Name` has to match `Name`
      const unprefixedKey = (component: SourceComponent): string | undefined => {
        const separator = component.fullName.indexOf('__');
        return separator > 0 ? `${component.type.name}#${component.fullName.slice(separator + 2)}` : undefined;
      };
      const candidates = this.groups.flatMap((group) =>
        group.components.flatMap((component) => {
          const unprefixed = unprefixedKey(component);
          const match = unprefixed ? extractedByKey.get(unprefixed) : undefined;
          return match && !extractedByKey.has(keyOf(component)) ? [{ component, match }] : [];
        })
      );
      const namespace = candidates.length > 0 ? (await this.orgNamespace())?.toLowerCase() : undefined;
      if (namespace) {
        for (const { component, match } of candidates) {
          if (component.fullName.toLowerCase().startsWith(`${namespace}__`))
            extractedByKey.set(keyOf(component), match);
        }
      }
      for (const group of this.groups) {
        const resolved = group.components.map((component) =>
          component.fullName === ComponentSet.WILDCARD ? component : extractedByKey.get(keyOf(component)) ?? component
        );
        const named = new Set(resolved.filter((component) => component.fullName !== ComponentSet.WILDCARD).map(keyOf));
        const emitted = new Set<SourceComponent>();
        // a wildcard member (`Type:*`) resolves to every component of that type the org returned
        group.components = resolved.flatMap((component) => {
          if (component.fullName !== ComponentSet.WILDCARD) {
            // `ns__Name` and `Name` can resolve to the same extracted component; download it once
            if (emitted.has(component)) return [];
            emitted.add(component);
            return [component];
          }
          return extracted.filter((candidate) => {
            const candidateKey = keyOf(candidate);
            if (candidate.type.name !== component.type.name || named.has(candidateKey)) return false;
            named.add(candidateKey);
            return true;
          });
        });
      }
    }

    const groups = this.groups.filter((group) => group.components.length > 0);
    const afterMetadataResults = await this.pipeline.runAfterMetadata(this.context, groups, this.operation);
    result.addTransportResults(
      afterMetadataResults.fileResponses,
      afterMetadataResults.asyncHandles,
      afterMetadataResults.operationResults
    );
  }

  private async orgNamespace(): Promise<string | undefined> {
    try {
      const { records } = await this.context.connection.query<{ NamespacePrefix: string | null }>(
        'SELECT NamespacePrefix FROM Organization'
      );
      return records[0]?.NamespacePrefix ?? undefined;
    } catch (err) {
      // without the namespace, prefixed members keep their requested names
      Logger.childFromRoot('TransportCoordinator').debug(
        'could not read the org namespace: %s',
        (err as Error).message
      );
      return undefined;
    }
  }
}
