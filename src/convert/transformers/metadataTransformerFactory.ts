/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { RegistryError } from '../../errors';
import { MetadataTransformer } from '../../types';
import { DefaultTransformer } from './default';
import { SourceComponent } from '../../metadata-registry/sourceComponent';
import { MetadataRegistry } from '../../metadata-registry';
import { DecomposedMetadataTransformer } from './decomposedMetadataTransformer';
import { ConvertTransaction } from '../convertTransaction';

const enum TransformerId {
  Standard = 'standard',
  Decomposed = 'decomposed',
}

export class MetadataTransformerFactory {
  private registry: MetadataRegistry;

  constructor(registry: MetadataRegistry) {
    this.registry = registry;
  }

  public getTransformer(
    component: SourceComponent,
    convertTransaction: ConvertTransaction
  ): MetadataTransformer {
    // transformer is determined by the parent, if the component has one
    const type = component.parent ? component.parent.type : component.type;
    const transformerId = this.registry.strategies.hasOwnProperty(type.id)
      ? (this.registry.strategies[type.id].transformer as TransformerId)
      : undefined;
    switch (transformerId) {
      case TransformerId.Decomposed:
        return new DecomposedMetadataTransformer(component, convertTransaction);
      case TransformerId.Standard:
      case undefined:
        return new DefaultTransformer(component, convertTransaction);
      default:
        throw new RegistryError('error_missing_transformer', [type.name, transformerId]);
    }
  }
}
