/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { MetadataTransformer, WriteInfo } from '../types';
import { ConvertContext } from '../convertContext/convertContext';
import { SourceComponent } from '../../resolve';
import { RegistryAccess } from '../../registry';

export abstract class BaseMetadataTransformer implements MetadataTransformer {
  public readonly context: ConvertContext;
  public defaultDirectory?: string;
  protected registry: RegistryAccess;

  public constructor(registry = new RegistryAccess(), context = new ConvertContext()) {
    this.registry = registry;
    this.context = context;
  }

  public abstract toMetadataFormat(component: SourceComponent): Promise<WriteInfo[]>;
  public abstract toSourceFormat(input: {
    component: SourceComponent;
    mergeWith?: SourceComponent;
  }): Promise<WriteInfo[]>;
}
