/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { MetadataTransformer, WriteInfo } from '../types';
import { ConvertTransaction } from '../convertTransaction';
import { RegistryAccess, SourceComponent } from '../../metadata-registry';

export abstract class BaseMetadataTransformer implements MetadataTransformer {
  protected registry: RegistryAccess;
  protected convertTransaction: ConvertTransaction;

  constructor(registry = new RegistryAccess(), convertTransaction = new ConvertTransaction()) {
    this.registry = registry;
    this.convertTransaction = convertTransaction;
  }

  public abstract toMetadataFormat(component: SourceComponent): Promise<WriteInfo[]>;
  public abstract toSourceFormat(
    component: SourceComponent,
    mergeWith?: SourceComponent
  ): Promise<WriteInfo[]>;
}
