/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { WriterFormat } from '../types';
import { parse as parseXml } from 'fast-xml-parser';
import { readFileSync } from 'fs';
import { BaseMetadataTransformer } from './baseMetadataTransformer';
import { RecompositionFinalizer, ConvertTransaction } from '../convertTransaction';
import { SourceComponent } from '../../metadata-registry';
import { XML_NS, XML_NS_KEY } from '../../utils/constants';
import { JsonMap, AnyJson, JsonArray } from '@salesforce/ts-types';
import { JsToXml } from '../streams';
import { join } from 'path';

interface RecomposedXmlJson extends JsonMap {
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
    const { type, xml, fullName: parentFullName } = this.component;
    const composedMetadata = parseXml(readFileSync(xml).toString())[type.name];
    const writerFormat: WriterFormat = {
      component: this.component,
      writeInfos: [],
    };
    const rootXmlObject = { [type.name]: {} };
    for (const [tagName, collection] of Object.entries(composedMetadata)) {
      const childType = Object.values(type.children.types).find(
        (type) => type.directoryName === tagName
      );
      if (childType) {
        const tagCollection = Array.isArray(collection) ? collection : [collection];
        const { directoryName: childDir, name: childTypeName } = childType;
        for (const entry of tagCollection) {
          const childSource = new JsToXml({
            [childTypeName]: Object.assign({ [XML_NS_KEY]: XML_NS }, entry),
          });
          const { fullName: childFullName } = entry as JsonMap;
          writerFormat.writeInfos.push({
            source: childSource,
            relativeDestination: join(
              type.directoryName,
              parentFullName,
              childDir,
              `${childFullName}.${childType.suffix}-meta.xml`
            ),
          });
        }
      } else {
        //@ts-ignore
        rootXmlObject[type.name][tagName] = collection;
      }
    }
    writerFormat.writeInfos.push({
      source: new JsToXml(rootXmlObject),
      relativeDestination: join(
        type.directoryName,
        parentFullName,
        `${parentFullName}.${type.suffix}-meta.xml`
      ),
    });

    return writerFormat;
  }

  public static recompose(
    children: SourceComponent[],
    baseXmlObj: RecomposedXmlJson = {}
  ): JsonMap {
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
