/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { WriteInfo } from '../types';
import { SourceComponent } from '../../metadata-registry';
import { DefaultMetadataTransformer } from './defaultMetadataTransformer';
import { LabelsIndex } from '../../utils/labelsIndex';
import { get, JsonMap } from '@salesforce/ts-types';
import { set } from '@salesforce/kit';
import deepmerge = require('deepmerge');
import { JsToXml } from '../streams';

export class CustomLabelsMetadataTransformer extends DefaultMetadataTransformer {
  public async toSourceFormat(
    component: SourceComponent,
    mergeWith?: SourceComponent
  ): Promise<WriteInfo[]> {
    const allLabelsXml = await component.parseXml();

    const index = await LabelsIndex.getInstance().resolve();
    // If there's only one CustomLabels file, then there's no need
    // to unpack the labels into their respective files
    if ([...index.keys()].length <= 1) {
      return super.toSourceFormat(component, mergeWith);
    }

    const writeInfos: WriteInfo[] = [];
    for (const [fsPath, labels] of [...index.entries()]) {
      const customLabelsObj = deepmerge({}, allLabelsXml);
      const filteredLabels = this.filterLabels(customLabelsObj, labels);
      set(customLabelsObj, 'CustomLabels.labels', filteredLabels);
      writeInfos.push({
        source: new JsToXml(customLabelsObj),
        output: fsPath,
      });
    }
    return writeInfos;
  }

  private filterLabels(customLabelsObj: JsonMap, labels: string[]): JsonMap[] {
    const unfilteredLabels = get(customLabelsObj, 'CustomLabels.labels', []) as Array<
      JsonMap & { fullName: string }
    >;
    return unfilteredLabels.filter((label) => labels.includes(label.fullName));
  }
}
