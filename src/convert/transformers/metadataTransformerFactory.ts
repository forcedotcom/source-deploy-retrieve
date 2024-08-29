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
import { DefaultMetadataTransformer } from './defaultMetadataTransformer';
import { DecomposedMetadataTransformer } from './decomposedMetadataTransformer';
import { StaticResourceMetadataTransformer } from './staticResourceMetadataTransformer';
import { NonDecomposedMetadataTransformer } from './nonDecomposedMetadataTransformer';
import { LabelMetadataTransformer, LabelsMetadataTransformer } from './decomposeLabelsTransformer';
import { FilePerChildTypeMetadataTransformer } from './filePerChildTypeMetadataTransformer';

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
      case 'standard':
      case undefined:
        return new DefaultMetadataTransformer(this.registry, this.context);
      case 'decomposed':
        return new DecomposedMetadataTransformer(this.registry, this.context);
      case 'staticResource':
        return new StaticResourceMetadataTransformer(this.registry, this.context);
      case 'nonDecomposed':
        return new NonDecomposedMetadataTransformer(this.registry, this.context);
      case 'filePerType':
        return new FilePerChildTypeMetadataTransformer(this.registry, this.context);
      case 'decomposedLabels':
        return component.type.name === 'CustomLabels'
          ? new LabelsMetadataTransformer(this.registry, this.context)
          : new LabelMetadataTransformer(this.registry, this.context);
      default:
        throw messages.createError('error_missing_transformer', [type.name, transformerId]);
    }
  }
}
