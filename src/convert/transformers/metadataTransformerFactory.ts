/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { RegistryError } from '../../errors';
import { MetadataTransformer } from '../types';
import { DefaultMetadataTransformer } from './defaultMetadataTransformer';
import { SourceComponent } from '../../metadata-registry/sourceComponent';
import { MetadataRegistry } from '../../metadata-registry';
import { DecomposedMetadataTransformer } from './decomposedMetadataTransformer';
import { ConvertTransaction } from '../convertTransaction';
import { StaticResourceMetadataTransformer } from './staticResourceMetadataTransformer';

const enum TransformerId {
  Standard = 'standard',
  Decomposed = 'decomposed',
  StaticResource = 'staticResource',
}

export class MetadataTransformerFactory {
  private registry: MetadataRegistry;
  private convertTransaction: ConvertTransaction;

  constructor(registry: MetadataRegistry, convertTransaction = new ConvertTransaction()) {
    this.registry = registry;
    this.convertTransaction = convertTransaction;
  }

  public getTransformer(component: SourceComponent): MetadataTransformer {
    // transformer is determined by the parent, if the component has one
    const type = component.parent ? component.parent.type : component.type;
    const transformerId = this.registry.strategies.hasOwnProperty(type.id)
      ? (this.registry.strategies[type.id].transformer as TransformerId)
      : undefined;
    switch (transformerId) {
      case TransformerId.Standard:
      case undefined:
        return new DefaultMetadataTransformer(this.registry, this.convertTransaction);
      case TransformerId.Decomposed:
        return new DecomposedMetadataTransformer(this.registry, this.convertTransaction);
      case TransformerId.StaticResource:
        return new StaticResourceMetadataTransformer(this.registry, this.convertTransaction);
      default:
        throw new RegistryError('error_missing_transformer', [type.name, transformerId]);
    }
  }
}
