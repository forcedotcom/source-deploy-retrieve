/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Messages } from '@salesforce/core';
import { MetadataTransformer } from '../types';
import { SourceComponent } from '../../resolve/sourceComponent';
import { ConvertContext } from '../convertContext/convertContext';
import { RegistryAccess } from '../../registry/registryAccess';
import { TransformerStrategy } from '../../registry/types';
import { DefaultMetadataTransformer } from './defaultMetadataTransformer';
import { DecomposedMetadataTransformer } from './decomposedMetadataTransformer';
import { StaticResourceMetadataTransformer } from './staticResourceMetadataTransformer';
import { NonDecomposedMetadataTransformer } from './nonDecomposedMetadataTransformer';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

export class MetadataTransformerFactory {
  private registry: RegistryAccess;
  private context: ConvertContext;

  public constructor(registry: RegistryAccess, context = new ConvertContext()) {
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
        throw messages.createError('error_missing_transformer', [type.name, transformerId]);
    }
  }
}
