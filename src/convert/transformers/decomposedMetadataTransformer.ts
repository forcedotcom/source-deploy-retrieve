/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { WriterFormat } from '../types';
import { j2xParser } from 'fast-xml-parser';
import { Readable } from 'stream';
import { BaseMetadataTransformer } from './baseMetadataTransformer';
import { RecompositionFinalizer, ConvertTransaction } from '../convertTransaction';
import { SourceComponent } from '../../metadata-registry';
import { XML_NS, XML_NS_KEY, XML_DECL } from '../../utils/constants';
import { LibraryError } from '../../errors';
import { JsonMap, AnyJson, JsonArray } from '@salesforce/ts-types';
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
    throw new LibraryError('error_convert_not_implemented', ['source', this.component.type.name]);
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

  public static createWriterFormat(trigger: SourceComponent, xmlJson: JsonMap): WriterFormat {
    const js2Xml = new j2xParser({ format: true, indentBy: '  ', ignoreAttributes: false });
    const source = new Readable();
    source.push(XML_DECL.concat(js2Xml.parse(xmlJson)));
    source.push(null);
    return {
      component: trigger,
      writeInfos: [
        {
          relativeDestination: join(
            trigger.type.directoryName,
            `${trigger.fullName}.${trigger.type.suffix}`
          ),
          source,
        },
      ],
    };
  }
}
