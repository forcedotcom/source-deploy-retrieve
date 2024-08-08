/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'node:path';
import { ensure, JsonMap } from '@salesforce/ts-types';
import type { CustomLabel } from '@jsforce/jsforce-node/lib/api/metadata';
import { customLabelHasFullName } from '../../utils/metadata';
import { MetadataType } from '../../registry';
import { XML_NS_KEY, XML_NS_URL } from '../../common/constants';
import { JsToXml } from '../streams';
import { WriterFormat } from '../types';
import { ConvertTransactionFinalizer } from './transactionFinalizer';

type CustomLabelState = {
  /*
   * Incoming child xml (CustomLabel) keyed by label fullname
   */
  customLabelByFullName: Map<string, CustomLabel>;
};

/**
 * Merges child components that share the same parent in the conversion pipeline
 * into a single file.
 *
 * Inserts unclaimed child components into the parent that belongs to the default package
 */
export class DecomposedCustomLabelsFinalizer extends ConvertTransactionFinalizer<CustomLabelState> {
  public transactionState: CustomLabelState = {
    customLabelByFullName: new Map(),
  };

  /** to support custom presets (the only way this code should get hit at all pass in the type from a transformer that has registry access */
  public customLabelsType?: MetadataType;

  // have to maintain the existing interface
  // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
  public async finalize(defaultDirectory?: string): Promise<WriterFormat[]> {
    if (this.transactionState.customLabelByFullName.size === 0) {
      return [];
    }
    return [
      {
        component: {
          type: ensure(this.customLabelsType, 'DecomposedCustomLabelsFinalizer should have set customLabelsType'),
          fullName: 'CustomLabels',
        },
        writeInfos: [
          {
            output: join(
              ensure(this.customLabelsType?.directoryName, 'directoryName missing from customLabels type'),
              'CustomLabels.labels'
            ),
            source: new JsToXml(generateXml(this.transactionState.customLabelByFullName)),
          },
        ],
      },
    ];
  }
}

/** Return a json object that's built up from the mergeMap children */
const generateXml = (children: Map<string, CustomLabel>): JsonMap => ({
  ['CustomLabels']: {
    [XML_NS_KEY]: XML_NS_URL,
    // for CustomLabels, that's `labels`
    labels: Array.from(children.values()).filter(customLabelHasFullName).sort(sortLabelsByFullName),
  },
});

type CustomLabelWithFullName = CustomLabel & { fullName: string };

const sortLabelsByFullName = (a: CustomLabelWithFullName, b: CustomLabelWithFullName): number =>
  a.fullName.localeCompare(b.fullName);
