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
