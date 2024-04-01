/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { JsonMap, getString } from '@salesforce/ts-types';
import { MetadataType } from '../registry/types';
/** handle wide-open reading of values from elements inside any metadata xml file...we don't know the type
 * Return the value of the matching element if supplied, or defaults `fullName` then `name`  */
export const extractUniqueElementValue = (xml: JsonMap, uniqueId?: string): string | undefined =>
  uniqueId ? getString(xml, uniqueId) ?? getStandardElements(xml) : getStandardElements(xml);

const getStandardElements = (xml: JsonMap): string | undefined =>
  getString(xml, 'fullName') ?? getString(xml, 'name') ?? undefined;

/** @returns xmlElementName if specified, otherwise returns the directoryName */
export const getXmlElement = (mdType: MetadataType): string => mdType.xmlElementName ?? mdType.directoryName;
