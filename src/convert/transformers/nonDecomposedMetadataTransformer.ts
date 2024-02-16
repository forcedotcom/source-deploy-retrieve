/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { get, getString, JsonMap } from '@salesforce/ts-types';
import { ensureArray } from '@salesforce/kit';
import { Messages } from '@salesforce/core';
import { WriteInfo } from '../types';
import { SourceComponent } from '../../resolve/sourceComponent';
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
  public async toSourceFormat(component: SourceComponent, mergeWith?: SourceComponent): Promise<WriteInfo[]> {
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

    this.context.nonDecomposition.transactionState.exampleComponent ??= component;

    incomingChildrenXml.map((child) => {
      if (!uniqueIdElement) {
        throw messages.createError('uniqueIdElementNotInRegistry', [
          component.type.name,
          component.fullName,
          component.xml,
        ]);
      }
      const childName = getString(child, uniqueIdElement);
      if (!childName) {
        throw messages.createError('uniqueIdElementNotInChild', [uniqueIdElement, component.fullName, component.xml]);
      }
      this.context.nonDecomposition.transactionState.childrenByUniqueElement.set(childName, child);
    });

    return [];
  }
}
