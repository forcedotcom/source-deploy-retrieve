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
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { Messages } from '@salesforce/core/messages';
import { SfError } from '@salesforce/core/sfError';
import { AnyJson, JsonMap } from '@salesforce/ts-types';
import { XML_NS_KEY, XML_NS_URL } from '../../common';
import { SourceComponent } from '../../resolve';
import { getXmlDestination } from '../transformers/defaultMetadataTransformer';
import { JsToXml } from '../streams';
import { WriterFormat } from '../types';
import { ConvertTransactionFinalizer } from './transactionFinalizer';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

type ProfileFragment = { component: SourceComponent; profile: JsonMap };
type ProfileState = Map<string, { component: SourceComponent; profiles: ProfileFragment[] }>;
type SourceProfileState = {
  component: SourceComponent;
  incoming: Promise<JsonMap>;
  locals: Map<string, { component: SourceComponent; profile: Promise<JsonMap> }>;
};

type SourceProfile = { component: SourceComponent; profile: JsonMap; touched: boolean };

export class ProfileMetadataFinalizer extends ConvertTransactionFinalizer<ProfileState> {
  public transactionState: ProfileState = new Map();
  private sourceProfiles = new Map<string, SourceProfileState>();

  public async add(component: SourceComponent): Promise<void> {
    const output = getXmlDestination('metadata', component);
    const profile = (await component.parseXml()).Profile as JsonMap;
    const state = this.transactionState.get(output) ?? { component, profiles: [] };
    state.profiles.push({ component, profile });
    this.transactionState.set(output, state);
  }

  public async addSource(component: SourceComponent, mergeWith: SourceComponent): Promise<void> {
    // Register shared state before any reads finish: fragment conversions run concurrently.
    let state = this.sourceProfiles.get(component.fullName);
    if (!state) {
      state = {
        component,
        incoming: component.parseXml().then((xml) => xml.Profile as JsonMap),
        locals: new Map(),
      };
      this.sourceProfiles.set(component.fullName, state);
    }
    if (mergeWith.xml && !state.locals.has(resolve(mergeWith.xml))) {
      state.locals.set(resolve(mergeWith.xml), {
        component: mergeWith,
        profile: mergeWith.parseXml().then((xml) => xml.Profile as JsonMap),
      });
    }
    await Promise.all([state.incoming, ...Array.from(state.locals.values(), ({ profile }) => profile)]);
  }

  public async finalize(defaultDirectory?: string): Promise<WriterFormat[]> {
    const results: WriterFormat[] = Array.from(this.transactionState, ([output, { component, profiles }]) => ({
      component,
      writeInfos: [{ output, source: new JsToXml({ Profile: mergeProfiles(profiles) }) }],
    }));
    const sourceResults = await Promise.all(
      Array.from(this.sourceProfiles.values(), async ({ component, incoming, locals }) => {
        const output = resolve(defaultDirectory ?? '', getXmlDestination('source', component));
        const sourceProfiles: SourceProfile[] = await Promise.all(
          Array.from(locals.values(), async ({ component: localComponent, profile }) => ({
            component: localComponent,
            profile: await profile,
            touched: false,
          }))
        );
        let defaultProfile: SourceProfile | undefined;
        if (existsSync(output)) {
          defaultProfile = sourceProfiles.find(
            ({ component: localComponent }) => resolve(localComponent.xml ?? '') === output
          );
          if (!defaultProfile) {
            const defaultComponent = new SourceComponent({
              name: component.fullName,
              type: component.type,
              xml: output,
            });
            defaultProfile = {
              component: defaultComponent,
              profile: (await defaultComponent.parseXml()).Profile as JsonMap,
              touched: false,
            };
            sourceProfiles.push(defaultProfile);
          }
        }

        for (const [key, value] of Object.entries(await incoming)) {
          if (key === XML_NS_KEY || value === undefined) continue;
          for (const entry of valuesOf(value)) {
            const owners = sourceProfiles.filter(({ profile }) =>
              valuesOf(profile[key]).some((local) => entriesMatch(key, local, entry))
            );
            if (owners.length) {
              owners.forEach((owner) => replaceEntry(owner, key, entry));
            } else {
              defaultProfile ??= {
                component: new SourceComponent({ name: component.fullName, type: component.type, xml: output }),
                profile: { [XML_NS_KEY]: XML_NS_URL },
                touched: false,
              };
              if (!sourceProfiles.includes(defaultProfile)) sourceProfiles.push(defaultProfile);
              appendEntry(defaultProfile, key, entry);
            }
          }
        }
        return sourceProfiles
          .filter(({ touched }) => touched)
          .map(({ component: sourceComponent, profile }) => ({
            component: sourceComponent,
            writeInfos: [{ output: sourceComponent.xml as string, source: new JsToXml({ Profile: profile }) }],
          }));
      })
    );
    results.push(...sourceResults.flat());
    return results;
  }
}

const singletonTags = new Set(['custom', 'description', 'loginHours', 'userLicense']);
const valuesOf = (value: JsonMap[string]): AnyJson[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];
const stringValue = (value: AnyJson | undefined): string | undefined => (typeof value === 'string' ? value : undefined);

const identityFields: Record<string, string> = {
  applicationVisibilities: 'application',
  categoryGroupVisibilities: 'dataCategoryGroup',
  classAccesses: 'apexClass',
  customMetadataTypeAccesses: 'name',
  customPermissions: 'name',
  customSettingAccesses: 'name',
  externalDataSourceAccesses: 'externalDataSource',
  fieldPermissions: 'field',
  flowAccesses: 'flow',
  objectPermissions: 'object',
  pageAccesses: 'apexPage',
  recordTypeVisibilities: 'recordType',
  tabVisibilities: 'tab',
  userPermissions: 'name',
};

const entryIdentity = (tag: string, entry: AnyJson): string | undefined => {
  if (singletonTags.has(tag)) return tag;
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return undefined;
  const map: JsonMap = entry;
  if (tag === 'layoutAssignments') {
    const layout = map.layout;
    const recordType = map.recordType;
    // A record type is the assignment slot. The layout is the mutable value.
    return typeof recordType === 'string'
      ? `recordType:${recordType}`
      : typeof layout === 'string'
      ? `default:${layout.split('-')[0]}`
      : undefined;
  }
  if (tag === 'loginIpRanges') {
    const startAddress = map.startAddress;
    const endAddress = map.endAddress;
    return typeof startAddress === 'string' && typeof endAddress === 'string'
      ? `${startAddress}:${endAddress}`
      : undefined;
  }
  if (tag === 'profileActionOverrides') {
    const values = [map.actionName, map.formFactor, map.pageOrSobjectType, map.recordType];
    const stringValues = values.map(stringValue);
    return values.every((value, index) => value === undefined || stringValues[index] !== undefined)
      ? stringValues.map((value) => value ?? '').join(':')
      : undefined;
  }
  const field = identityFields[tag];
  return field && typeof map[field] === 'string' ? map[field] : undefined;
};

const entriesMatch = (tag: string, local: AnyJson, incoming: AnyJson): boolean => {
  const localIdentity = entryIdentity(tag, local);
  const incomingIdentity = entryIdentity(tag, incoming);
  return localIdentity && incomingIdentity ? localIdentity === incomingIdentity : isDeepStrictEqual(local, incoming);
};

const replaceEntry = (source: SourceProfile, tag: string, incoming: AnyJson): void => {
  const existing = valuesOf(source.profile[tag]);
  const replacement = existing.map((entry) => (entriesMatch(tag, entry, incoming) ? incoming : entry));
  if (!isDeepStrictEqual(existing, replacement)) {
    source.profile[tag] = singletonTags.has(tag) ? replacement[0] : replacement;
    source.touched = true;
  }
};

const appendEntry = (source: SourceProfile, tag: string, entry: AnyJson): void => {
  const entries = valuesOf(source.profile[tag]);
  source.profile[tag] = singletonTags.has(tag) ? entry : entries.concat(entry);
  source.touched = true;
};

const mergeProfiles = (profiles: ProfileFragment[], validateSingletons = true): JsonMap => {
  const merged: JsonMap = { [XML_NS_KEY]: XML_NS_URL };
  const owners = new Map<string, SourceComponent>();

  for (const { component, profile } of profiles) {
    for (const [key, value] of Object.entries(profile)) {
      if (key === XML_NS_KEY || value === undefined) continue;
      const mergedValues = valuesOf(merged[key]);
      for (const entry of valuesOf(value)) {
        if (mergedValues.some((existing) => isDeepStrictEqual(existing, entry))) continue;
        if (validateSingletons && singletonTags.has(key) && mergedValues.length) {
          throw new SfError(
            messages.getMessage('error_profile_singleton_conflict', [
              component.fullName,
              key,
              owners.get(key)?.xml,
              component.xml,
            ]),
            'ConversionError'
          );
        }
        mergedValues.push(entry);
        owners.set(key, component);
      }
      merged[key] = mergedValues;
    }
  }

  return merged;
};
