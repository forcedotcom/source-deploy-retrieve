/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { MetadataTransformer, SfdxFileFormat, WriteInfo, WriterFormat } from '../types';
import { ConvertTransaction } from '../convertTransaction';
import { RegistryAccess, SourceComponent } from '../../metadata-registry';
import { ComponentSet } from '../../collections';

export abstract class BaseMetadataTransformer implements MetadataTransformer {
  protected registry: RegistryAccess;
  protected convertTransaction: ConvertTransaction;
  protected writes: WriteInfo[] = [];

  constructor(registry = new RegistryAccess(), convertTransaction = new ConvertTransaction()) {
    this.registry = registry;
    this.convertTransaction = convertTransaction;
  }

  public async createWriteOperations(
    component: SourceComponent,
    targetFormat: SfdxFileFormat,
    mergeWith?: Iterable<SourceComponent>
  ): Promise<WriterFormat> {
    const converts: Promise<WriterFormat>[] = [];
    if (targetFormat === 'source') {
      if (mergeWith) {
        for (const mergeComponent of mergeWith) {
          converts.push(this.toSourceFormat(component, mergeComponent));
        }
      }
      if (this.writes.length === 0) {
        converts.push(this.toSourceFormat(component));
      }
    } else {
      converts.push(this.toMetadataFormat(component));
    }

    await Promise.all(converts);

    return { component, writeInfos: this.writes };
  }

  public abstract toMetadataFormat(component: SourceComponent): Promise<WriterFormat>;
  public abstract toSourceFormat(
    component: SourceComponent,
    mergeWith?: SourceComponent
  ): Promise<WriterFormat>;
}
