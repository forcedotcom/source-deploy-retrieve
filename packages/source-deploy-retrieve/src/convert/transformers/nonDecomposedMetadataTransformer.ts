/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { WriteInfo } from '../types';
import { DecomposedMetadataTransformer } from './decomposedMetadataTransformer';
import { get, getString, JsonMap } from '@salesforce/ts-types';
import { normalizeToArray } from '../../utils';
import { SourceComponent } from '../../resolve';

/**
 * Metadata Transformer for metadata types with children types that are NOT decomposed into separate files.
 *
 * Example Types:
 * - CustomLabels
 */
export class NonDecomposedMetadataTransformer extends DecomposedMetadataTransformer {
  public async toSourceFormat(
    component: SourceComponent,
    mergeWith?: SourceComponent
  ): Promise<WriteInfo[]> {
    const parentXml = await component.parseXml();
    const xmlPathToChildren = `${component.type.name}.${component.type.directoryName}`;
    const incomingChildrenXml = normalizeToArray(get(parentXml, xmlPathToChildren)) as JsonMap[];

    const children = mergeWith?.getChildren() ?? [];
    const claimedChildren = children.map((c) => c.name);
    const [childTypeId] = Object.keys(component.type.children.types);
    const { uniqueIdElement } = component.type.children.types[childTypeId];

    for (const child of incomingChildrenXml) {
      const childName = getString(child, uniqueIdElement);
      if (claimedChildren.includes(childName)) {
        this.setStateForClaimed(mergeWith, childName, child);
      } else {
        this.setStateForUnclaimed(component, childName, child);
      }
    }

    return [];
  }

  private setStateForClaimed(parent: SourceComponent, childName: string, child: JsonMap): void {
    this.context.nonDecomposition.setState((state) => {
      const existingChildren = state.claimed[parent.xml]?.children ?? {};
      const updatedChildren = Object.assign({}, existingChildren, { [childName]: child });
      state.claimed[parent.xml] = Object.assign(state.claimed[parent.xml] ?? {}, {
        parent,
        children: updatedChildren,
      });
    });
  }

  private setStateForUnclaimed(parent: SourceComponent, childName: string, child: JsonMap): void {
    this.context.nonDecomposition.setState((state) => {
      const existingChildren = state.unclaimed[parent.xml]?.children ?? {};
      const updatedChildren = Object.assign({}, existingChildren, { [childName]: child });
      state.unclaimed[parent.xml] = Object.assign(state.unclaimed[parent.xml] ?? {}, {
        parent,
        children: updatedChildren,
      });
    });
  }
}
