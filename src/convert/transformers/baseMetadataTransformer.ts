/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Logger } from '@salesforce/core';
import { MetadataTransformer, WriteInfo } from '../types';
import { ConvertContext } from '../convertContext';
import { SourceComponent } from '../../resolve';
import { RegistryAccess } from '../../registry';

export abstract class BaseMetadataTransformer implements MetadataTransformer {
  public readonly context: ConvertContext;
  public defaultDirectory?: string;
  protected registry: RegistryAccess;
  protected logger: Logger;

  public constructor(registry = new RegistryAccess(), context = new ConvertContext()) {
    this.registry = registry;
    this.context = context;
    this.logger = Logger.childFromRoot(this.constructor.name);
  }

  public abstract toMetadataFormat(component: SourceComponent): Promise<WriteInfo[]>;
  public abstract toSourceFormat(component: SourceComponent, mergeWith?: SourceComponent): Promise<WriteInfo[]>;
}
