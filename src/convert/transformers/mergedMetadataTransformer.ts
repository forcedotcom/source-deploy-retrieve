/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Messages } from '@salesforce/core';
import { ensureArray } from '@salesforce/kit';
import { JsonArray, JsonMap } from '@salesforce/ts-types';
import { WriteInfo } from '../types';
import { SourceComponent } from '../../resolve';
import { JsToXml } from '../streams';
import { MergeStrategy } from '../../registry';
import { DefaultMetadataTransformer } from './defaultMetadataTransformer';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

/**
 * The merged metadata transformer.
 *
 * Merge incomming metadata with metadata that is already on disk.
 * This is useful for profiles because retrieved profile metadata is
 * dependant upon the other metadata types included in the same retrieve.
 *
 * If there is no existing metadata - fallback to default behaviour.
 */
export class MergedMetadataTransformer extends DefaultMetadataTransformer {
  // eslint-disable-next-line @typescript-eslint/require-await, class-methods-use-this
  public async toSourceFormat(component: SourceComponent, mergeWith?: SourceComponent): Promise<WriteInfo[]> {
    if (!mergeWith?.xml) {
      return super.toSourceFormat(component, mergeWith);
    }

    const config = component.type.strategies?.transformerConfig;

    if (!config) {
      throw messages.createError('error_missing_transformerConfig', [component.type?.name]);
    }

    const { rootNode, defaultHandling, nodeHandling } = config;

    const source: JsonMap = await component.parseXml();
    const target: JsonMap = await mergeWith.parseXml();

    if (!(rootNode in source)) {
      // Nothing to merge into profile
      return [];
    }

    if (!(rootNode in target)) {
      target[rootNode] = {} as JsonMap;
    }

    for (const [nodeName, nodeEntryOrEntries] of Object.entries(source[rootNode] as JsonMap)) {
      if (nodeName.startsWith('@')) {
        continue;
      }

      const nodeEntries = ensureArray(nodeEntryOrEntries) as JsonArray;
      const { strategy, mappingKey } = nodeHandling[nodeName] || defaultHandling;

      let updatedNodeEntries;

      switch (strategy) {
        case MergeStrategy.Replace:
          updatedNodeEntries = nodeEntries;
          break;

        case MergeStrategy.Merge:
          // @ts-ignore: Object is possibly 'null'.
          if (!target[rootNode][nodeName]) {
            updatedNodeEntries = nodeEntries;
            continue;
          }

          if (!mappingKey) {
            throw messages.createError('error_missing_transformerConfig_mappingKey', [component.type?.name]);
          }

          // @ts-ignore: Object is possibly 'null'.
          updatedNodeEntries = mergeNodes(mappingKey, nodeEntries, ensureArray(target[rootNode][nodeName]));
          break;
        default:
          throw messages.createError('error_invalid_merge_strategy', [strategy]);
      }

      // @ts-ignore: Object is possibly 'null'.
      target[rootNode][nodeName] = updatedNodeEntries;
    }

    const sortedTarget = {};
    // @ts-ignore: Object is possibly 'null'.
    sortedTarget[rootNode] = {};

    // @ts-ignore: Object is possibly 'null'.
    for (const nodeName of Object.keys(target[rootNode]).sort()) {
      // @ts-ignore: Object is possibly 'null'.
      sortedTarget[rootNode][nodeName] = target[rootNode][nodeName];
    }

    // TODO: implement deleteOnEmpty - if target contains any nodes that don't exist in source + have deleteOnEmpty enabled - delete those nodes from target
    // e.g. ip address ranges - these are always returned with Profile, if they are not there - they've been removed
    // (unlike say fieldPermissions where they are not there because no fields are being retrieved)

    return [
      {
        source: new JsToXml(sortedTarget),
        output: mergeWith.xml,
      },
    ];
  }
}

const mergeNodes = (mappingKey: string, sourceNodes: JsonArray, targetNodes: JsonArray): JsonArray => {
  // @ts-ignore: Object is possibly 'null'.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  const sourceKeys = sourceNodes.map((node) => node[mappingKey]);

  // @ts-ignore: Object is possibly 'null'.
  const mergedEntries = targetNodes.filter((node) => !sourceKeys.includes(node[mappingKey]));
  mergedEntries.push(...sourceNodes);
  mergedEntries.sort((a, b) => {
    // @ts-ignore: Object is possibly 'null'.
    if (a[mappingKey] > b[mappingKey]) {
      return 1;
    }

    // @ts-ignore: Object is possibly 'null'.
    if (a[mappingKey] < b[mappingKey]) {
      return -1;
    }

    return 0;
  });

  return mergedEntries;
};
