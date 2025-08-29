/*
 * Copyright 2025, Salesforce, Inc.
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
export class DecomposedLabelsFinalizer extends ConvertTransactionFinalizer<CustomLabelState> {
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
