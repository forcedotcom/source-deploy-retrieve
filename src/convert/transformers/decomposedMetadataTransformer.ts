/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { WriteInfo, WriterFormat } from '../types';
import { parse as parseXml } from 'fast-xml-parser';
import { readFileSync } from 'fs';
import { BaseMetadataTransformer } from './baseMetadataTransformer';
import { RecompositionFinalizer, ConvertTransaction } from '../convertTransaction';
import { SourceComponent } from '../../metadata-registry';
import { META_XML_SUFFIX, XML_NS, XML_NS_KEY } from '../../utils/constants';
import { JsonMap, AnyJson, JsonArray } from '@salesforce/ts-types';
import { JsToXml } from '../streams';
import { join } from 'path';

interface XmlJson extends JsonMap {
  [parentFullName: string]: {
    [groupNode: string]: AnyJson;
  };
}

export class DecomposedMetadataTransformer extends BaseMetadataTransformer {
  constructor(component: SourceComponent, convertTransaction: ConvertTransaction) {
    super(component, convertTransaction);
    this.convertTransaction.addFinalizer(RecompositionFinalizer);
  }

  public toMetadataFormat(): WriterFormat {
    if (this.component.parent) {
      const { state } = this.convertTransaction;
      const { fullName: parentName } = this.component.parent;
      if (!state.recompose[parentName]) {
        state.recompose[parentName] = {
          component: this.component.parent,
          children: [],
        };
      }
      state.recompose[parentName].children.push(this.component);
      // noop since the finalizer will push the writes to the component writer
      return { component: this.component, writeInfos: [] };
    }

    const recomposedXmlObj = DecomposedMetadataTransformer.recompose(
      this.component.getChildren(),
      this.component.parseXml() as RecomposedXmlJson
    );

    return DecomposedMetadataTransformer.createWriterFormat(this.component, recomposedXmlObj);
  }

  public toSourceFormat(): WriterFormat {
    const writeInfos: WriteInfo[] = [];

    const { type, xml, fullName: parentFullName } = this.component;
    const composedMetadata = parseXml(readFileSync(xml).toString())[type.name];
    const rootXmlObject: XmlJson = { [type.name]: {} };

    for (const [tagName, collection] of Object.entries(composedMetadata)) {
      const childTypeId = type?.children?.directories[tagName];
      if (childTypeId) {
        const childType = type.children.types[childTypeId];
        const tagCollection = Array.isArray(collection) ? collection : [collection];
        const { directoryName: childDir, name: childTypeName } = childType;
        for (const entry of tagCollection) {
          const childSource = new JsToXml({
            [childTypeName]: Object.assign({ [XML_NS_KEY]: XML_NS }, entry),
          });
          const { fullName: childFullName } = entry as JsonMap;
          writeInfos.push({
            source: childSource,
            relativeDestination: join(
              type.directoryName,
              parentFullName,
              childDir,
              `${childFullName}.${childType.suffix}${META_XML_SUFFIX}`
            ),
          });
        }
      } else {
        rootXmlObject[type.name][tagName] = collection as JsonArray;
      }
    }

    writeInfos.push({
      source: new JsToXml(rootXmlObject),
      relativeDestination: join(
        type.directoryName,
        parentFullName,
        `${parentFullName}.${type.suffix}${META_XML_SUFFIX}`
      ),
    });

    return { component: this.component, writeInfos };
  }

  public static recompose(children: SourceComponent[], baseXmlObj: XmlJson = {}): JsonMap {
    for (const child of children) {
      const { directoryName: groupNode } = child.type;
      const { name: parentName } = child.parent.type;
      const childContents = child.parseXml()[child.type.name];

      if (!baseXmlObj[parentName]) {
        baseXmlObj[parentName] = { '@_xmlns': XML_NS };
      } else if (!baseXmlObj[parentName][XML_NS_KEY]) {
        baseXmlObj[parentName][XML_NS_KEY] = XML_NS;
      }

      if (!baseXmlObj[parentName][groupNode]) {
        baseXmlObj[parentName][groupNode] = [];
      }
      (baseXmlObj[parentName][groupNode] as JsonArray).push(childContents);
    }
    return baseXmlObj;
  }

  public static createWriterFormat(trigger: SourceComponent, xmlObject: JsonMap): WriterFormat {
    return {
      component: trigger,
      writeInfos: [
        {
          source: new JsToXml(xmlObject),
          relativeDestination: join(
            trigger.type.directoryName,
            `${trigger.fullName}.${trigger.type.suffix}`
          ),
        },
      ],
    };
  }
}
