/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { get, getString, JsonMap } from '@salesforce/ts-types';
import { WriteInfo } from '../types';
import { normalizeToArray } from '../../utils';
import { SourceComponent } from '../../resolve';
import { DecomposedMetadataTransformer } from './decomposedMetadataTransformer';

/**
 * Metadata Transformer for metadata types with children types that are NOT decomposed into separate files.
 *
 * Example Types:
 * - CustomLabels
 */
export class NonDecomposedMetadataTransformer extends DecomposedMetadataTransformer {
  public async toSourceFormat(component: SourceComponent, mergeWith?: SourceComponent): Promise<WriteInfo[]> {
    // this will only include the retrieved labels, not the entire file
    const parentXml = await component.parseXml();
    const xmlPathToChildren = `${component.type.name}.${component.type.directoryName}`;
    const incomingChildrenXml = normalizeToArray(get(parentXml, xmlPathToChildren)) as JsonMap[];
    const childrenFromExisting = mergeWith?.getChildren().map((c) => c.name) ?? [];

    const [childTypeId] = Object.keys(component.type.children.types);
    const { uniqueIdElement } = component.type.children.types[childTypeId];

    incomingChildrenXml.map((child) => {
      const childName = getString(child, uniqueIdElement);
      this.setState(
        childrenFromExisting.includes(childName),
        childrenFromExisting.includes(childName) ? mergeWith : component,
        childName,
        child
      );
    });

    return [];
  }

  private setState(matches: boolean, parent: SourceComponent, childName: string, child: JsonMap): void {
    this.context.nonDecomposition.setState((state) => {
      const matchingProperty = matches ? 'incomingMatches' : 'incomingNonMatches';
      const existingChildren = state[matchingProperty][parent.xml]?.children ?? {};
      const updatedChildren = Object.assign({}, existingChildren, { [childName]: child });
      state[matchingProperty][parent.xml] = Object.assign(state[matchingProperty][parent.xml] ?? {}, {
        parent,
        children: updatedChildren,
      });
    });
  }
}
