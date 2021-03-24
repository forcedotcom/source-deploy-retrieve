/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { JsToXml } from '../streams';
import { NonDecomposedIndex } from '../../utils/nonDecomposedIndex';
import { normalizeToArray } from '../../utils';
import { set } from '@salesforce/kit';
import { SourceComponent } from '../../metadata-registry';
import { WriteInfo } from '../types';
import deepmerge = require('deepmerge');
import { DecomposedMetadataTransformer } from './decomposedMetadataTransformer';
import { get, JsonMap } from '@salesforce/ts-types';

/**
 * Metadata Transformer for metadata types with children types that are NOT decomposed into separate files.
 *
 * Example Types:
 * - CustomLabels
 */
export class NonDecomposedMetadataTransformer extends DecomposedMetadataTransformer {
  public async toSourceFormat(
    component: SourceComponent,
    mergeWith?: SourceComponent
  ): Promise<WriteInfo[]> {
    const allLabelsObj = await component.parseXml();
    const index = await NonDecomposedIndex.getInstance().resolve(mergeWith);

    const writeInfos: WriteInfo[] = [];
    for (const [fsPath, elements] of [...index.entries()]) {
      const nonDecomposedObj = deepmerge({}, allLabelsObj);
      const filteredElements = this.filterElements(component, nonDecomposedObj, elements);
      if (filteredElements.length) {
        set(nonDecomposedObj, component.type.strategies.elementParser.xmlPath, filteredElements);
        writeInfos.push({ source: new JsToXml(nonDecomposedObj), output: fsPath });
      }
    }
    return writeInfos;
  }

  /**
   * Only return elements that belong to the component
   */
  private filterElements(
    component: SourceComponent,
    nonDecomposedObj: JsonMap,
    elements: string[]
  ): JsonMap[] {
    const { xmlPath, nameAttr } = component.type.strategies.elementParser;
    const unfiltered = normalizeToArray(get(nonDecomposedObj, xmlPath, []) as JsonMap[]);
    return unfiltered.filter((element) => elements.includes(element[nameAttr] as string));
  }
}
