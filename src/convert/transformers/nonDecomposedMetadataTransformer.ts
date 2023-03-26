/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { get, getString, JsonMap } from '@salesforce/ts-types';
import { ensureArray } from '@salesforce/kit';
import { SfError } from '@salesforce/core';
import { WriteInfo } from '../types';
import { SourceComponent } from '../../resolve';
import { DecomposedMetadataTransformer } from './decomposedMetadataTransformer';

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
      throw new SfError(
        `No child types found in registry for ${component.type.name} (reading ${component.fullName} ${component.xml})`
      );
    }
    // presumes they only have 1 child!
    const [childTypeId] = Object.keys(component.type.children.types);
    const { uniqueIdElement } = component.type.children.types[childTypeId];

    this.context.nonDecomposition.transactionState.exampleComponent ??= component;

    incomingChildrenXml.map((child) => {
      if (!uniqueIdElement) {
        throw new SfError(
          `No uniqueIdElement found in registry for ${component.type.name} (reading ${component.fullName} ${component.xml})`
        );
      }
      const childName = getString(child, uniqueIdElement);
      if (!childName) {
        throw new SfError(
          `The uniqueIdElement ${uniqueIdElement} was not found the child (reading ${component.fullName} ${component.xml})`
        );
      }
      this.context.nonDecomposition.transactionState.childrenByUniqueElement.set(childName, child);
    });

    return [];
  }
}
