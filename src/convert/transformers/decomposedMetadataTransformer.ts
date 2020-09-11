/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { WriteInfo, WriterFormat } from '../types';
import { BaseMetadataTransformer } from './baseMetadataTransformer';
import { RecompositionFinalizer, ConvertTransaction } from '../convertTransaction';
import { MetadataRegistry, registryData, SourceComponent } from '../../metadata-registry';
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
  constructor(
    registry: MetadataRegistry = registryData,
    convertTransaction = new ConvertTransaction()
  ) {
    super(registry, convertTransaction);
    this.convertTransaction.addFinalizer(RecompositionFinalizer);
  }

  public toMetadataFormat(component: SourceComponent): WriterFormat {
    if (component.parent) {
      const { state } = this.convertTransaction;
      const { fullName: parentName } = component.parent;
      if (!state.recompose[parentName]) {
        state.recompose[parentName] = {
          component: component.parent,
          children: [],
        };
      }
      state.recompose[parentName].children.push(component);
      // noop since the finalizer will push the writes to the component writer
      return { component: component, writeInfos: [] };
    }

    const recomposedXmlObj = DecomposedMetadataTransformer.recompose(
      component.getChildren(),
      component.parseXml() as XmlJson
    );

    return DecomposedMetadataTransformer.createWriterFormat(component, recomposedXmlObj);
  }

  public toSourceFormat(component: SourceComponent): WriterFormat {
    const writeInfos: WriteInfo[] = [];

    const { type, fullName: parentFullName } = component;
    const composedMetadata = component.parseXml()[type.name];
    const rootXmlObject: XmlJson = { [type.name]: {} };

    for (const [tagName, collection] of Object.entries(composedMetadata)) {
      const childTypeId = type?.children?.directories[tagName];
      if (childTypeId) {
        const childType = type.children.types[childTypeId];
        const tagCollection = Array.isArray(collection) ? collection : [collection];
        for (const entry of tagCollection) {
          const childSource = new JsToXml({
            [childType.name]: Object.assign({ [XML_NS_KEY]: XML_NS }, entry),
          });
          const name = (entry.fullName || entry.name) as string;
          let relativeDestination = join(type.directoryName, parentFullName);
          if (this.registry.strategies[type.id].decomposition === 'folderPerType') {
            relativeDestination = join(relativeDestination, childType.directoryName);
          }
          relativeDestination = join(
            relativeDestination,
            `${name}.${childType.suffix}${META_XML_SUFFIX}`
          );
          writeInfos.push({ source: childSource, relativeDestination });
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

    return { component, writeInfos };
  }

  public static recompose(children: SourceComponent[], baseXmlObj: XmlJson = {}): JsonMap {
    for (const child of children) {
      const { directoryName: groupNode } = child.type;
      const { name: parentName } = child.parent.type;
      const childContents = child.parseXml()[child.type.name];
      if (!baseXmlObj[parentName]) {
        baseXmlObj[parentName] = { '@_xmlns': XML_NS };
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
