/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'node:path';
import { ensure, JsonMap } from '@salesforce/ts-types';
import type { PermissionSet } from '@jsforce/jsforce-node/lib/api/metadata/schema';
import { MetadataType } from '../../registry';
import { XML_NS_KEY, XML_NS_URL } from '../../common/constants';
import { JsToXml } from '../streams';
import { WriterFormat } from '../types';
import { ConvertTransactionFinalizer } from './transactionFinalizer';

type PermissionSetState = {
  /*
   * Incoming child xml (CustomLabel) keyed by label fullname
   */
  permissionSetChildByPath: Map<string, PermissionSet>;
};

/**
 * Merges child components that share the same parent in the conversion pipeline
 * into a single file.
 *
 * Inserts unclaimed child components into the parent that belongs to the default package
 */
export class DecomposedPermissionSetFinalizer extends ConvertTransactionFinalizer<PermissionSetState> {
  public transactionState: PermissionSetState = {
    permissionSetChildByPath: new Map(),
  };

  /** to support custom presets (the only way this code should get hit at all pass in the type from a transformer that has registry access */
  public permissionSetType?: MetadataType;

  // have to maintain the existing interface
  // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
  public async finalize(defaultDirectory?: string): Promise<WriterFormat[]> {
    if (this.transactionState.permissionSetChildByPath.size === 0) {
      return [];
    }

    const fullName = Array.from(this.transactionState.permissionSetChildByPath.keys())[0].split(':')[1].split('.')[0];

    return [
      {
        component: {
          type: ensure(this.permissionSetType, 'DecomposedPermissionSetFinalizer should have set PermissionSetType'),
          fullName,
        },
        writeInfos: [
          {
            output: join(
              ensure(this.permissionSetType?.directoryName, 'directoryName missing from PermissionSet type'),
              `${fullName}.permissionset`
            ),
            source: new JsToXml(generateXml(this.transactionState.permissionSetChildByPath)),
          },
        ],
      },
    ];
  }
}

/** Return a json object that's built up from the mergeMap children */
const generateXml = (children: Map<string, PermissionSet>): JsonMap => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  ['PermissionSet']: {
    [XML_NS_KEY]: XML_NS_URL,
    // for CustomLabels, that's `labels`
    ...Object.assign({}, ...children.values()),
    // labels: Array.from(children.values()).filter(customLabelHasFullName).sort(sortLabelsByFullName),
  },
});

// type CustomLabelWithFullName = PermissionSet & { fullName: string };
//
// const sortLabelsByFullName = (a: CustomLabelWithFullName, b: CustomLabelWithFullName): number =>
//   a.fullName.localeCompare(b.fullName);
