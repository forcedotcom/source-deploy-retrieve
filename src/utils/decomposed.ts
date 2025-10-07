/*
 * Copyright 2025, Salesforce, Inc.
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
import { JsonMap, getString } from '@salesforce/ts-types';
import { XmlObj } from '../convert/types';
import { XML_NS_KEY } from '../common/constants';
import { MetadataType } from '../registry/types';

/** handle wide-open reading of values from elements inside any metadata xml file...we don't know the type
 * Return the value of the matching element if supplied, or defaults `fullName` then `name`  */
export const extractUniqueElementValue = (xml: JsonMap, uniqueId?: string): string | undefined =>
  uniqueId ? getString(xml, uniqueId) ?? getStandardElements(xml) : getStandardElements(xml);

const getStandardElements = (xml: JsonMap): string | undefined =>
  getString(xml, 'fullName') ?? getString(xml, 'name') ?? undefined;

/** @returns xmlElementName if specified, otherwise returns the directoryName */
export const getXmlElement = (mdType: MetadataType): string => mdType.xmlElementName ?? mdType.directoryName;
/** composed function, exported from module for test */

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

/** Ex: CustomObject: { '@_xmlns': 'http://soap.sforce.com/2006/04/metadata' } has no real values */
export const objectHasSomeRealValues =
  (type: MetadataType) =>
  (obj: XmlObj): boolean =>
    Object.keys(obj[type.name] ?? {}).length > 1;
