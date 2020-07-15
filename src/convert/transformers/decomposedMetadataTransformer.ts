/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { WriterFormat } from '../../types';
import { parse as parseXml, j2xParser } from 'fast-xml-parser';
import { readFileSync } from 'fs';
import { Readable } from 'stream';
import { META_XML_SUFFIX } from '../../utils';
import { BaseMetadataTransformer } from './baseMetadataTransformer';
import { RecompositionFinalizer, ConvertTransaction } from '../convertTransaction';
import { SourceComponent } from '../../metadata-registry';
import { XML_NS, XML_NS_KEY, XML_DECL } from '../../utils/constants';

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
          children: []
        };
      }
      state.recompose[parentName].children.push(this.component);
      // noop since the finalizer will push the writes to the component writer
      return { component: this.component, writeInfos: [] };
    }

    const baseXmlObj = parseXml(readFileSync(this.component.xml).toString());
    const recomposedXmlObj = DecomposedMetadataTransformer.recompose(
      this.component.getChildren(),
      baseXmlObj
    );
    return DecomposedMetadataTransformer.createWriterFormat(this.component, recomposedXmlObj);
  }

  public toSourceFormat(): WriterFormat {
    throw new Error('Method not implemented.');
  }

  public static recompose(children: SourceComponent[], baseXmlObj: any = {}): any {
    for (const child of children) {
      const { directoryName: groupNode } = child.type;
      const { name: parentName } = child.parent.type;
      const parsedChild = parseXml(readFileSync(child.xml).toString());
      const childContents = parsedChild[child.type.name];

      if (!baseXmlObj[parentName]) {
        baseXmlObj[parentName] = { '@_xmlns': XML_NS };
      } else if (!baseXmlObj[parentName][XML_NS_KEY]) {
        baseXmlObj[parentName][XML_NS_KEY] = XML_NS;
      }

      if (!baseXmlObj[parentName][groupNode]) {
        baseXmlObj[parentName][groupNode] = [];
      }
      baseXmlObj[parentName][groupNode].push(childContents);
    }
    return baseXmlObj;
  }

  public static createWriterFormat(trigger: SourceComponent, xmlJson: any): WriterFormat {
    const js2Xml = new j2xParser({ format: true, indentBy: '  ', ignoreAttributes: false });
    const source = new Readable();
    source.push(XML_DECL.concat(js2Xml.parse(xmlJson)));
    source.push(null);
    let xmlDest = trigger.getPackageRelativePath(trigger.xml);
    xmlDest = xmlDest.slice(0, xmlDest.lastIndexOf(META_XML_SUFFIX));
    return {
      component: trigger,
      writeInfos: [
        {
          relativeDestination: xmlDest,
          source
        }
      ]
    };
  }
}
