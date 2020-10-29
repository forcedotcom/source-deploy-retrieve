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
import { DecomposedMetadataTransformer } from './decomposedMetadataTransformer';
import { ConvertTransaction } from '../convertTransaction';
import { StaticResourceMetadataTransformer } from './staticResourceMetadataTransformer';
import { RegistryAccess, TransformerStrategy } from '../../metadata-registry';

export class MetadataTransformerFactory {
  private registry: RegistryAccess;
  private convertTransaction: ConvertTransaction;

  constructor(registry: RegistryAccess, convertTransaction = new ConvertTransaction()) {
    this.registry = registry;
    this.convertTransaction = convertTransaction;
  }

  public getTransformer(component: SourceComponent): MetadataTransformer {
    // transformer is determined by the parent, if the component has one
    const type = component.parent ? component.parent.type : component.type;
    const transformerId = type.strategies?.transformer;
    switch (transformerId) {
      case TransformerStrategy.Standard:
      case undefined:
        return new DefaultMetadataTransformer(this.registry, this.convertTransaction);
      case TransformerStrategy.Decomposed:
        return new DecomposedMetadataTransformer(this.registry, this.convertTransaction);
      case TransformerStrategy.StaticResource:
        return new StaticResourceMetadataTransformer(this.registry, this.convertTransaction);
      default:
        throw new RegistryError('error_missing_transformer', [type.name, transformerId]);
    }
  }
}
