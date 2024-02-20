/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'node:path';
import { JsonMap } from '@salesforce/ts-types';
import { Messages } from '@salesforce/core';
import { extractUniqueElementValue, getXmlElement } from '../../utils/decomposed';
import { MetadataComponent } from '../../resolve/types';
import { XML_NS_KEY, XML_NS_URL } from '../../common/constants';
import { ComponentSet } from '../../collections/componentSet';
import { RecompositionStrategy } from '../../registry/types';
import { SourceComponent } from '../../resolve/sourceComponent';
import { JsToXml } from '../streams';
import { WriterFormat } from '../types';
import { ConvertTransactionFinalizer } from './transactionFinalizer';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

const xmlCache = new Map<string, JsonMap>();

export type RecompositionStateValue = {
  /**
   * Parent component that children are rolled up into
   */
  component?: SourceComponent;
  /**
   * Children to be rolled up into the parent file
   */
  children?: ComponentSet;
};

export type RecompositionState = Map<string, RecompositionStateValue>;

type RecompositionStateValueWithParent = RecompositionStateValue & { component: SourceComponent };

/**
 * Merges child components that share the same parent in the conversion pipeline
 * into a single file.
 */
export class RecompositionFinalizer extends ConvertTransactionFinalizer<RecompositionState> {
  public transactionState: RecompositionState = new Map<string, RecompositionStateValue>();

  public async finalize(): Promise<WriterFormat[]> {
    return Promise.all(
      [...this.transactionState.values()].filter(ensureStateValueWithParent).map(stateValueToWriterFormat)
    );
  }
}

const stateValueToWriterFormat = async (stateValue: RecompositionStateValueWithParent): Promise<WriterFormat> => ({
  component: stateValue.component,
  writeInfos: [
    {
      source: new JsToXml(await recompose(stateValue)),
      output: join(
        stateValue.component.type.directoryName,
        `${stateValue.component.fullName}.${stateValue.component.type.suffix}`
      ),
    },
  ],
});

type ChildWithXml = {
  xmlContents: JsonMap;
  cmp: SourceComponent;
  groupName: string;
};

const recompose = async (stateValue: RecompositionStateValueWithParent): Promise<JsonMap> => {
  await getXmlFromCache(stateValue.component);

  const childXmls = await Promise.all(
    (stateValue.children ?? new ComponentSet())
      .toArray()
      .filter(ensureMetadataComponentWithParent)
      .map(
        async (child): Promise<ChildWithXml> => ({
          cmp: child,
          xmlContents: await getXmlFromCache(child),
          groupName: getXmlElement(child.type),
        })
      )
  );

  const parentXmlContents = {
    [XML_NS_KEY]: XML_NS_URL,
    ...(await getStartingXml(stateValue.component)),
    // group them into an object of arrays by groupName, then merge into parent
    ...toSortedGroups(childXmls),
  };

  return {
    [stateValue.component.type.name]: parentXmlContents,
  };
};

/** @returns {} if StartEmpty, otherwise gets the parent xml */
const getStartingXml = async (parent: SourceComponent): Promise<JsonMap> =>
  parent.type.strategies?.recomposition === RecompositionStrategy.StartEmpty
    ? {}
    : unwrapAndOmitNS(parent.type.name)(await getXmlFromCache(parent)) ?? {};

/** throw if the parent component isn't in the state entry */
const ensureStateValueWithParent = (
  stateValue: RecompositionStateValue
): stateValue is RecompositionStateValueWithParent => {
  if (stateValue.component) {
    return true;
  }
  throw new Error(
    `The parent component is missing from the recomposition state entry.  The children are ${stateValue.children
      ?.toArray()
      .map((c) => c.fullName)
      .join(', ')}`
  );
};

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

const getXmlFromCache = async (cmp: SourceComponent): Promise<JsonMap> => {
  if (!cmp.xml) return {};
  const key = `${cmp.xml}:${cmp.fullName}`;
  if (!xmlCache.has(key)) {
    const parsed =
      cmp.parent?.type.strategies?.transformer === 'nonDecomposed'
        ? cmp.parseFromParentXml({ [cmp.parent.type.name]: await getXmlFromCache(cmp.parent) })
        : unwrapAndOmitNS(cmp.type.name)(await cmp.parseXml()) ?? {};
    xmlCache.set(key, parsed);
  }
  return xmlCache.get(key) ?? {};
};

/** exported from module for test */
export const unwrapAndOmitNS =
  (outerType: string) =>
  (xml: JsonMap): JsonMap =>
    omitNsKey(unwrapXml(outerType)(xml));

/** Remove the namespace key from the json object.  Only the parent needs one */
const omitNsKey = (obj: JsonMap): JsonMap =>
  Object.fromEntries(Object.entries(obj).filter(([key]) => key !== XML_NS_KEY)) as JsonMap;

const unwrapXml =
  (outerType: string) =>
  (xml: JsonMap): JsonMap =>
    // assert that the outerType is also a metadata type name (ex: CustomObject)
    (xml[outerType] as JsonMap) ?? xml;
