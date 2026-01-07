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

import type { CustomLabel } from '@jsforce/jsforce-node/lib/api/metadata';
import { ensureArray } from '@salesforce/kit';
import { customLabelHasFullName } from '../../utils/metadata';
import { calculateRelativePath } from '../../utils/path';
import { SourceComponent } from '../../resolve/sourceComponent';
import { ToSourceFormatInput, WriteInfo } from '../types';
import { JsToXml } from '../streams';
import { unwrapAndOmitNS } from '../../utils/decomposed';
import { DefaultMetadataTransformer } from './defaultMetadataTransformer';

/* Use for the metadata type CustomLabels  */
export class LabelsMetadataTransformer extends DefaultMetadataTransformer {
  /** CustomLabels file => Array of CustomLabel WriteInfo (one for each label) */
  public async toSourceFormat({ component, mergeSet }: ToSourceFormatInput): Promise<WriteInfo[]> {
    const labelType = this.registry.getTypeByName('CustomLabel');
    const partiallyAppliedPathCalculator = calculateRelativePath('source')({
      self: labelType,
    });
    const xml = unwrapAndOmitNS('CustomLabels')(await component.parseXml()) as { labels: CustomLabel | CustomLabel[] };
    return ensureArray(xml.labels) // labels could parse to a single object and not an array if there's only 1 label
      .filter(customLabelHasFullName)
      .map((l) => ({
        // split each label into a separate label file
        output:
          // if present in the merge set, use that xml path, otherwise use the default path
          mergeSet?.getComponentFilenamesByNameAndType({ fullName: l.fullName, type: labelType.name })?.[0] ??
          partiallyAppliedPathCalculator(l.fullName)(`${l.fullName}.label-meta.xml`),
        source: new JsToXml({ CustomLabel: l }),
      }));
  }
}

/* Use for the metadata type CustomLabel */
export class LabelMetadataTransformer extends DefaultMetadataTransformer {
  public async toMetadataFormat(component: SourceComponent): Promise<WriteInfo[]> {
    // only need to do this once
    this.context.decomposedLabels.customLabelsType ??= this.registry.getTypeByName('CustomLabels');
    this.context.decomposedLabels.transactionState.customLabelByFullName.set(
      component.fullName,
      unwrapAndOmitNS('CustomLabel')(await component.parseXml()) as CustomLabel
    );
    return [];
  }

  // toSourceFormat uses the default (merge them with the existing label)
}
