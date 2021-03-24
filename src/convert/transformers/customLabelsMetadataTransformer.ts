/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DefaultMetadataTransformer } from './defaultMetadataTransformer';
import { JsToXml } from '../streams';
import { LabelsIndex, CustomLabelsObj, CustomLabel } from '../../utils/labelsIndex';
import { normalizeToArray } from '../../utils';
import { set } from '@salesforce/kit';
import { SourceComponent } from '../../metadata-registry';
import { WriteInfo } from '../types';
import deepmerge = require('deepmerge');

export class CustomLabelsMetadataTransformer extends DefaultMetadataTransformer {
  public async toSourceFormat(
    component: SourceComponent,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mergeWith?: SourceComponent
  ): Promise<WriteInfo[]> {
    const allLabelsObj = await component.parseXml<CustomLabelsObj>();
    const index = await LabelsIndex.getInstance().resolve();
    console.log(index);
    const writeInfos: WriteInfo[] = [];
    for (const [fsPath, labels] of [...index.entries()]) {
      const customLabelsObj = deepmerge({}, allLabelsObj);
      const filteredLabels = this.filterLabels(customLabelsObj, labels);
      if (filteredLabels.length) {
        set(customLabelsObj, 'CustomLabels.labels', filteredLabels);
        writeInfos.push({ source: new JsToXml(customLabelsObj), output: fsPath });
      }
    }
    return writeInfos;
  }

  private filterLabels(customLabelsObj: CustomLabelsObj, labels: string[]): CustomLabel[] {
    const unfilteredLabels = normalizeToArray(customLabelsObj.CustomLabels?.labels || []);
    return unfilteredLabels.filter((label) => labels.includes(label.fullName));
  }
}
