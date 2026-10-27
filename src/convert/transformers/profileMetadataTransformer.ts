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
import { SourceComponent } from '../../resolve/sourceComponent';
import { ComponentSet } from '../../collections/componentSet';
import { WriteInfo } from '../types';
import { DefaultMetadataTransformer } from './defaultMetadataTransformer';

export class ProfileMetadataTransformer extends DefaultMetadataTransformer {
  public async toMetadataFormat(component: SourceComponent): Promise<WriteInfo[]> {
    await this.context.profileMetadata.add(component);
    return [];
  }

  public async toSourceFormat({
    component,
    mergeWith,
    mergeSet,
  }: {
    component: SourceComponent;
    mergeWith?: SourceComponent;
    mergeSet?: ComponentSet;
  }): Promise<WriteInfo[]> {
    if (!mergeSet || !mergeWith) {
      return super.toSourceFormat({ component, mergeWith });
    }
    await this.context.profileMetadata.addSource(component, mergeWith);
    return [];
  }
}
