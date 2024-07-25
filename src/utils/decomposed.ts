/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { JsonMap, getString } from '@salesforce/ts-types';
import { XmlObj } from '../convert/transformers/decomposedMetadataTransformer';
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
