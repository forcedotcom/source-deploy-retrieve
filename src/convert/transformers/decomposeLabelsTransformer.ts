/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { CustomLabel } from '@jsforce/jsforce-node/lib/api/metadata';
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
    const xml = unwrapAndOmitNS('CustomLabels')(await component.parseXml()) as { labels: CustomLabel[] };
    // split each label into a separate label file
    return xml.labels.filter(customLabelHasFullName).map((l) => ({
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
