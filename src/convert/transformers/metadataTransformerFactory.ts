/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { RegistryError } from '../../errors';
import { MetadataTransformer } from '../types';
import { DefaultMetadataTransformer } from './defaultMetadataTransformer';
import { SourceComponent } from '../../resolve/sourceComponent';
import { DecomposedMetadataTransformer } from './decomposedMetadataTransformer';
import { ConvertContext } from '../convertContext';
import { StaticResourceMetadataTransformer } from './staticResourceMetadataTransformer';
import { RegistryAccess, TransformerStrategy } from '../../registry';
import { NonDecomposedMetadataTransformer } from './nonDecomposedMetadataTransformer';

export class MetadataTransformerFactory {
  private registry: RegistryAccess;
  private context: ConvertContext;

  constructor(registry: RegistryAccess, context = new ConvertContext()) {
    this.registry = registry;
    this.context = context;
  }

  public getTransformer(component: SourceComponent): MetadataTransformer {
    // transformer is determined by the parent, if the component has one
    const type = component.parent ? component.parent.type : component.type;
    const transformerId = type.strategies?.transformer;
    switch (transformerId) {
      case TransformerStrategy.Standard:
      case undefined:
        return new DefaultMetadataTransformer(this.registry, this.context);
      case TransformerStrategy.Decomposed:
        return new DecomposedMetadataTransformer(this.registry, this.context);
      case TransformerStrategy.StaticResource:
        return new StaticResourceMetadataTransformer(this.registry, this.context);
      case TransformerStrategy.NonDecomposed:
        return new NonDecomposedMetadataTransformer(this.registry, this.context);
      default:
        throw new RegistryError('error_missing_transformer', [type.name, transformerId]);
    }
  }
}
