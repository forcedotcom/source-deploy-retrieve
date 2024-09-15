/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AnyJson, JsonMap } from '@salesforce/ts-types';
import { MetadataType } from '../../registry';
import { MetadataComponent, SourceComponent } from '../../resolve';

export type ComposedMetadata = { tagKey: string; tagValue: AnyJson; parentType: MetadataType; childTypeId?: string };
export type ComposedMetadataWithChildType = ComposedMetadata & { childType: MetadataType };

export type InfoContainer = {
  entryName: string;
  childComponent: MetadataComponent;
  /** the parsed xml */
  value: JsonMap;
  parentComponent: SourceComponent;
  mergeWith?: SourceComponent;
};
