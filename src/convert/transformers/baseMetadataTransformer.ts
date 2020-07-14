/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { MetadataTransformer, WriterFormat, SourceComponent } from '../../types';
import { ConvertTransaction } from '../convertTransaction';

export abstract class BaseMetadataTransformer implements MetadataTransformer {
  protected component: SourceComponent;
  protected convertTransaction: ConvertTransaction;

  constructor(component: SourceComponent, convertTransaction: ConvertTransaction) {
    this.component = component;
    this.convertTransaction = convertTransaction;
  }

  public abstract toMetadataFormat(): WriterFormat;
  public abstract toSourceFormat(): WriterFormat;
}
