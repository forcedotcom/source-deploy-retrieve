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
import { join } from 'node:path';
import { JsonMap } from '@salesforce/ts-types';
import { Messages } from '@salesforce/core/messages';
import { extractUniqueElementValue, getXmlElement, unwrapAndOmitNS } from '../../utils/decomposed';
import { MetadataComponent } from '../../resolve/types';
import { XML_NS_KEY, XML_NS_URL } from '../../common/constants';
import { ComponentSet, SimpleKeyString } from '../../collections/componentSet';
import { SourceComponent } from '../../resolve/sourceComponent';
import { JsToXml } from '../streams';
import { WriterFormat } from '../types';
import { ConvertTransactionFinalizer } from './transactionFinalizer';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

type RecompositionStateValue = {
  /**
   * Parent component that children are rolled up into
   */
  component?: SourceComponent;
  /**
   * Children to be rolled up into the parent file
   */
  children?: ComponentSet;
};

type RecompositionState = Map<string, RecompositionStateValue>;

type RecompositionStateValueWithParent = RecompositionStateValue & { component: SourceComponent };
type XmlCache = Map<string, JsonMap>;
/**
 * Merges child components that share the same parent in the conversion pipeline into a single file.
 *
 * Handles both Decomposed and NonDecomposed strategies.
 *
 */
export class RecompositionFinalizer extends ConvertTransactionFinalizer<RecompositionState> {
  public transactionState: RecompositionState = new Map<SimpleKeyString, RecompositionStateValue>();
  private xmlCache: XmlCache = new Map();

  public async finalize(): Promise<WriterFormat[]> {
    return Promise.all(
      [...this.transactionState.values()]
        .filter(ensureStateValueWithParent)
        .map(stateValueToWriterFormat(this.xmlCache))
    );
  }
}

const stateValueToWriterFormat =
  (cache: XmlCache) =>
  async (stateValue: RecompositionStateValueWithParent): Promise<WriterFormat> => ({
    component: stateValue.component,
    writeInfos: [
      {
        source: new JsToXml(await recompose(cache)(stateValue)),
        output: join(
          stateValue.component.type.directoryName,
          `${stateValue.component.fullName}.${stateValue.component.type.suffix ?? ''}`
        ),
      },
    ],
  });

type ChildWithXml = {
  xmlContents: JsonMap;
  cmp: SourceComponent;
  groupName: string;
};

const recompose =
  (cache: XmlCache) =>
  async (stateValue: RecompositionStateValueWithParent): Promise<JsonMap> => {
    const childComponents = stateValue.children?.toArray() ?? [];

    // RecompositionState combines all labels metadata files into 1 component containing
    // all the children.  This checks for multiple parent components and gets the xml
    // file content from each.
    if (
      childComponents.length &&
      stateValue.component.type.strategies?.recomposition === 'startEmpty' &&
      stateValue.component.type.strategies?.transformer === 'nonDecomposed'
    ) {
      const parentLabelNames: string[] = [];
      for (const childComp of childComponents) {
        const parentComp = childComp.parent as SourceComponent;
        if (parentComp && !parentLabelNames.includes(parentComp.name)) {
          parentLabelNames.push(parentComp.name);
          // eslint-disable-next-line no-await-in-loop
          await getXmlFromCache(cache)(parentComp);
        }
      }
    } else {
      await getXmlFromCache(cache)(stateValue.component);
    }

    const childXmls = await Promise.all(
      childComponents.filter(ensureMetadataComponentWithParent).map(
        async (child): Promise<ChildWithXml> => ({
          cmp: child,
          xmlContents: await getXmlFromCache(cache)(child),
          groupName: getXmlElement(child.type),
        })
      )
    );

    const parentXmlContents = {
      [XML_NS_KEY]: XML_NS_URL,
      ...(await getStartingXml(cache)(stateValue.component)),
      // group them into an object of arrays by groupName, then merge into parent
      ...toSortedGroups(childXmls),
    };

    return {
      [stateValue.component.type.name]: parentXmlContents,
    };
  };

/** @returns {} if StartEmpty, otherwise gets the parent xml */
const getStartingXml =
  (cache: XmlCache) =>
  async (parent: SourceComponent): Promise<JsonMap> =>
    parent.type.strategies?.recomposition === 'startEmpty'
      ? {}
      : unwrapAndOmitNS(parent.type.name)(await getXmlFromCache(cache)(parent)) ?? {};

/** throw if the parent component isn't in the state entry */
const ensureStateValueWithParent = (
  stateValue: RecompositionStateValue
): stateValue is RecompositionStateValueWithParent => {
  if (stateValue.component) {
    return true;
  }
  throw new Error(
    `The parent component is missing from the recomposition state entry.  ${
      stateValue.children
        ? `The children are ${stateValue.children
            ?.toArray()
            .map((c) => c.fullName)
            .join(', ')}
    `
        : 'There are no children.'
    }`
  );
};

/** throw if the child has no parent component */
const ensureMetadataComponentWithParent = (
  child: MetadataComponent
): child is SourceComponent & { parent: SourceComponent } => {
  // all components should be SourceComponent at this point
  if (child instanceof SourceComponent && child.parent) {
    return true;
  }
  throw messages.createError('noParent', [child.fullName, child.type.name]);
};

/** sorts based on the uniqueId / fullname /name property in the xml */
const childSorter = (a: ChildWithXml, b: ChildWithXml): number => {
  const aValue = extractUniqueElementValue(a.xmlContents, a.cmp.type.uniqueIdElement) ?? '';
  const bValue = extractUniqueElementValue(b.xmlContents, b.cmp.type.uniqueIdElement) ?? '';
  return aValue.localeCompare(bValue);
};

/** organize into sorted arrays by groupName */
const toSortedGroups = (items: ChildWithXml[]): JsonMap => {
  const groupNames = [...new Set(items.map((item) => item.groupName))].sort();
  return Object.fromEntries(
    groupNames.map((groupName) => [
      groupName,
      items
        .filter((item) => item.groupName === groupName)
        // TODO: use asSorted when we can use it on all supported node versions
        .sort(childSorter)
        .map((i) => i.xmlContents),
    ])
  );
};

/** wrapper around the xml cache.  Handles the nonDecomposed "parse from parent" optimization */
const getXmlFromCache =
  (xmlCache: XmlCache) =>
  async (cmp: SourceComponent): Promise<JsonMap> => {
    if (!cmp.xml) return {};
    const key = `${cmp.xml}:${cmp.fullName}`;
    if (!xmlCache.has(key)) {
      const parsed =
        cmp.parent?.type.strategies?.transformer === 'nonDecomposed'
          ? cmp.parseFromParentXml({ [cmp.parent.type.name]: await getXmlFromCache(xmlCache)(cmp.parent) })
          : unwrapAndOmitNS(cmp.type.name)(await cmp.parseXml()) ?? {};
      xmlCache.set(key, parsed);
    }
    return xmlCache.get(key) ?? {};
  };
