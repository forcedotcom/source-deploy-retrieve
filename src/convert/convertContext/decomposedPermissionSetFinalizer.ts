/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'node:path';
import { ensure, ensureString } from '@salesforce/ts-types';
import type { PermissionSet } from '@jsforce/jsforce-node/lib/api/metadata/schema';
import { MetadataType } from '../../registry';
import { XML_NS_KEY, XML_NS_URL } from '../../common/constants';
import { JsToXml } from '../streams';
import { WriterFormat } from '../types';
import { ConvertTransactionFinalizer } from './transactionFinalizer';

type PermissionSetState = {
  /*
   * Incoming child xml (children of PS) which will be partial parts of a PermissionSet, keyed by the parent they belong to
   */
  parentToChild: Map<string, PermissionSet[]>;
};

/**
 * Merges child components that share the same related object (/objectSettings/<object name>.objectSettings) in the conversion pipeline
 * into a single file.
 *
 * Inserts unclaimed child components into the parent that belongs to the default package
 */
export class DecomposedPermissionSetFinalizer extends ConvertTransactionFinalizer<PermissionSetState> {
  public transactionState: PermissionSetState = {
    parentToChild: new Map(),
  };

  /** to support custom presets (the only way this code should get hit at all pass in the type from a transformer that has registry access */
  public permissionSetType?: MetadataType;

  // have to maintain the existing interface
  // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
  public async finalize(defaultDirectory?: string): Promise<WriterFormat[]> {
    if (this.transactionState.parentToChild.size === 0) {
      return [];
    }

    const agg: WriterFormat[] = [];
    this.transactionState.parentToChild.forEach((children, parent) => {
      agg.push({
        component: {
          type: ensure(this.permissionSetType, 'DecomposedPermissionSetFinalizer should have set PermissionSetType'),
          fullName: ensureString(parent),
        },
        writeInfos: [
          {
            output: join(
              ensure(this.permissionSetType?.directoryName, 'directoryName missing from PermissionSet type'),
              `${parent}.permissionset`
            ),
            source: new JsToXml({
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              PermissionSet: {
                [XML_NS_KEY]: XML_NS_URL,
                ...Object.assign(
                  {},
                  // sort the children by fullName
                  ...Object.values(children.sort((a, b) => ((a.fullName ?? '') > (b.fullName ?? '') ? -1 : 1)))
                ),
              },
            }),
          },
        ],
      });
    });

    return agg;
  }
}
