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
import { JsonMap } from '@salesforce/ts-types';
import { XML_NS_KEY, XML_NS_URL } from '../../common/constants';
import { SourceComponent } from '../../resolve/sourceComponent';
import { getXmlDestination } from '../transformers/defaultMetadataTransformer';
import { JsToXml } from '../streams';
import { WriterFormat } from '../types';
import { ConvertTransactionFinalizer } from './transactionFinalizer';

type ProfileState = Map<string, { component: SourceComponent; profiles: JsonMap[] }>;

export class ProfileMetadataFinalizer extends ConvertTransactionFinalizer<ProfileState> {
  public transactionState: ProfileState = new Map();

  public async add(component: SourceComponent): Promise<void> {
    const output = getXmlDestination('metadata', component);
    const profile = (await component.parseXml()).Profile as JsonMap;
    const state = this.transactionState.get(output) ?? { component, profiles: [] };
    state.profiles.push(profile);
    this.transactionState.set(output, state);
  }

  public finalize(): Promise<WriterFormat[]> {
    return Promise.resolve(
      Array.from(this.transactionState, ([output, { component, profiles }]) => ({
        component,
        writeInfos: [{ output, source: new JsToXml({ Profile: mergeProfiles(profiles) }) }],
      }))
    );
  }
}

const mergeProfiles = (profiles: JsonMap[]): JsonMap => {
  const merged: JsonMap = { [XML_NS_KEY]: XML_NS_URL };

  for (const profile of profiles) {
    for (const [key, value] of Object.entries(profile)) {
      if (key === XML_NS_KEY || value === undefined) continue;
      const values = Array.isArray(value) ? value : [value];
      const mergedValues = Array.isArray(merged[key]) ? merged[key] : [];
      merged[key] = mergedValues.concat(values);
    }
  }

  return merged;
};
