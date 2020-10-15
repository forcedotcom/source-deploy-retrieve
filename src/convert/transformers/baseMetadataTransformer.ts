/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { MetadataTransformer, WriterFormat } from '../types';
import { ConvertTransaction } from '../convertTransaction';
import { MetadataRegistry, registryData, SourceComponent } from '../../metadata-registry';

export abstract class BaseMetadataTransformer implements MetadataTransformer {
  protected registry: MetadataRegistry;
  protected convertTransaction: ConvertTransaction;

  constructor(
    registry: MetadataRegistry = registryData,
    convertTransaction = new ConvertTransaction()
  ) {
    this.registry = registry;
    this.convertTransaction = convertTransaction;
  }

  public abstract toMetadataFormat(component: SourceComponent): Promise<WriterFormat>;
  public abstract toSourceFormat(
    component: SourceComponent,
    mergeWith?: SourceComponent
  ): Promise<WriterFormat>;
}
