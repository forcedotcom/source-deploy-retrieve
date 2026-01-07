/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { Messages } from '@salesforce/core/messages';
import { MetadataTransformer } from '../types';
import { SourceComponent } from '../../resolve';
import { ConvertContext } from '../convertContext/convertContext';
import { RegistryAccess } from '../../registry';
import { DefaultMetadataTransformer } from './defaultMetadataTransformer';
import { DecomposedMetadataTransformer } from './decomposedMetadataTransformer';
import { StaticResourceMetadataTransformer } from './staticResourceMetadataTransformer';
import { NonDecomposedMetadataTransformer } from './nonDecomposedMetadataTransformer';
import { LabelMetadataTransformer, LabelsMetadataTransformer } from './decomposeLabelsTransformer';
import { DecomposedPermissionSetTransformer } from './decomposedPermissionSetTransformer';
import { DecomposeExternalServiceRegistrationTransformer } from './decomposeExternalServiceRegistrationTransformer';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

export class MetadataTransformerFactory {
  public constructor(private readonly registry: RegistryAccess, private readonly context = new ConvertContext()) {
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
      case 'decomposedPermissionSet':
        return new DecomposedPermissionSetTransformer(this.registry, this.context);
      case 'decomposedLabels':
        return component.type.name === 'CustomLabels'
          ? new LabelsMetadataTransformer(this.registry, this.context)
          : new LabelMetadataTransformer(this.registry, this.context);
      case 'decomposeExternalServiceRegistration':
        return new DecomposeExternalServiceRegistrationTransformer(this.registry, this.context);
      default:
        throw messages.createError('error_missing_transformer', [type.name, transformerId]);
    }
  }
}
