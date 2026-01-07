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
import { join } from 'node:path';
import { ensure, ensureString } from '@salesforce/ts-types';
import type { PermissionSet } from '@jsforce/jsforce-node/lib/api/metadata/schema';
import { ensureArray } from '@salesforce/kit';
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
      // iterate over children and build PermissionSet data structure
      const permset = new Map<string, unknown[]>();
      for (const child of children) {
        for (const [key, value] of Object.entries(child)) {
          const existingEntry = permset.get(key);
          if (existingEntry) {
            if (Array.isArray(value)) {
              permset.set(key, existingEntry.concat(value));
            } else {
              existingEntry.push(value);
              permset.set(key, existingEntry);
            }
          } else {
            permset.set(key, ensureArray<unknown>(value));
          }
        }
      }
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
              PermissionSet: {
                [XML_NS_KEY]: XML_NS_URL,
                ...Object.fromEntries(permset),
              },
            }),
          },
        ],
      });
    });

    return agg;
  }
}
