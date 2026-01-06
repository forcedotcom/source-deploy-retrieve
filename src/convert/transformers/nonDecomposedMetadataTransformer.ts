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

import { get, getString, JsonMap } from '@salesforce/ts-types';
import { ensureArray } from '@salesforce/kit';
import { Messages } from '@salesforce/core/messages';
import { ToSourceFormatInput, WriteInfo } from '../types';
import { DecomposedMetadataTransformer } from './decomposedMetadataTransformer';
Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');
/**
 * Metadata Transformer for metadata types with children types that are NOT decomposed into separate files.
 *
 * Example Types:
 * - CustomLabels
 */
export class NonDecomposedMetadataTransformer extends DecomposedMetadataTransformer {
  // streams uses mergeWith for all types.  Removing it would break the interface
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async toSourceFormat({ component, mergeWith }: ToSourceFormatInput): Promise<WriteInfo[]> {
    // this will only include the incoming (retrieved) labels, not the local file
    const parentXml = await component.parseXml();
    const xmlPathToChildren = `${component.type.name}.${component.type.directoryName}`;
    const incomingChildrenXml = ensureArray(get(parentXml, xmlPathToChildren)) as JsonMap[];
    if (!component.type.children) {
      throw messages.createError('noChildTypes', [component.type.name, component.fullName, component.xml]);
    }
    // presumes they only have 1 child!
    const [childTypeId] = Object.keys(component.type.children.types);
    const { uniqueIdElement } = component.type.children.types[childTypeId];
    if (!uniqueIdElement) {
      throw messages.createError('uniqueIdElementNotInRegistry', [
        component.type.name,
        component.fullName,
        component.xml,
      ]);
    }

    this.context.nonDecomposition.transactionState.exampleComponent ??= component;

    incomingChildrenXml.map((child) => {
      const childName = getString(child, uniqueIdElement);
      if (!childName) {
        throw messages.createError('uniqueIdElementNotInChild', [uniqueIdElement, component.fullName, component.xml]);
      }
      this.context.nonDecomposition.transactionState.childrenByUniqueElement.set(childName, child);
    });

    return [];
  }
}
