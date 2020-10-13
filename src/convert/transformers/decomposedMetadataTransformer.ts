/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { WriteInfo, WriterFormat } from '../types';
import { BaseMetadataTransformer } from './baseMetadataTransformer';
import { RecompositionFinalizer, ConvertTransaction } from '../convertTransaction';
import {
  DecompositionStrategy,
  MetadataRegistry,
  registryData,
  SourceComponent,
} from '../../metadata-registry';
import { META_XML_SUFFIX, XML_NS, XML_NS_KEY } from '../../utils/constants';
import { JsonMap, AnyJson, JsonArray } from '@salesforce/ts-types';
import { JsToXml } from '../streams';
import { join } from 'path';
import { ComponentSet, MetadataType, SourcePath } from '../../common';

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

  public static async recompose(
    children: SourceComponent[],
    baseXmlObj: XmlJson = {}
  ): Promise<JsonMap> {
    for (const child of children) {
      const { directoryName: groupNode } = child.type;
      const { name: parentName } = child.parent.type;
      const childContents = (await child.parseXml())[child.type.name];
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
          output: join(trigger.type.directoryName, `${trigger.fullName}.${trigger.type.suffix}`),
        },
      ],
    };
  }

  public async toMetadataFormat(component: SourceComponent): Promise<WriterFormat> {
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

    const recomposedXmlObj = await DecomposedMetadataTransformer.recompose(
      component.getChildren(),
      (await component.parseXml()) as XmlJson
    );

    return DecomposedMetadataTransformer.createWriterFormat(component, recomposedXmlObj);
  }

  public async toSourceFormat(
    component: SourceComponent,
    mergeWith?: SourceComponent
  ): Promise<WriterFormat> {
    const writeInfos: WriteInfo[] = [];
    const { type, fullName: parentFullName } = component;
    const parentXmlObject: XmlJson = { [type.name]: {} };

    let createParentXml = false;
    const rootPackagePath = component.getPackageRelativePath(parentFullName, 'source');
    const childComponentMergeSet = mergeWith
      ? new ComponentSet(mergeWith.getChildren())
      : undefined;

    const composedMetadata = await this.getComposedMetadataEntries(component);
    for (const [tagKey, tagValue] of composedMetadata) {
      const childTypeId = type.children?.directories[tagKey];
      const childType = type.children?.types[childTypeId];
      if (childType) {
        const tagValues = Array.isArray(tagValue) ? tagValue : [tagValue];
        for (const value of tagValues) {
          const entryName = (value.fullName || value.name) as string;
          const mergeChild = childComponentMergeSet?.get({
            fullName: `${parentFullName}.${entryName}`,
            type: childType,
          });
          const output =
            mergeChild?.xml ||
            join(rootPackagePath, this.getOutputPathForEntry(entryName, childType, component));

          writeInfos.push({
            source: new JsToXml({
              [childType.name]: Object.assign({ [XML_NS_KEY]: XML_NS }, value),
            }),
            output,
          });
        }
      } else {
        // tag entry isn't a child type, so add it to the parent xml
        createParentXml = true;
        parentXmlObject[type.name][tagKey] = tagValue as JsonArray;
      }
    }

    if (createParentXml) {
      const parentOutput =
        mergeWith?.xml ||
        join(rootPackagePath, `${parentFullName}.${type.suffix}${META_XML_SUFFIX}`);
      writeInfos.push({
        source: new JsToXml(parentXmlObject),
        output: parentOutput,
      });
    }

    return { component, writeInfos };
  }

  private async getComposedMetadataEntries(component: SourceComponent): Promise<[string, any][]> {
    const composedMetadata = (await component.parseXml())[component.type.name];
    return Object.entries(composedMetadata);
  }

  private getOutputPathForEntry(
    entryName: string,
    entryType: MetadataType,
    component: SourceComponent
  ): SourcePath {
    const { type } = component;
    const strategy = this.registry.strategies[type.id].decomposition as DecompositionStrategy;

    let output: SourcePath;
    if (strategy === DecompositionStrategy.FolderPerType) {
      output = join(output, entryType.directoryName);
    }

    return join(output, `${entryName}.${entryType.suffix}${META_XML_SUFFIX}`);
  }
}
