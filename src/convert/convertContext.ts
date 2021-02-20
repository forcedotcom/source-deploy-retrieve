/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { WriteInfo, WriterFormat } from './types';
import { SourceComponent } from '../metadata-registry';
import { join } from 'path';
import { JsToXml } from './streams';
import { MetadataComponent, XML_NS_KEY, XML_NS_URL } from '../common';
import { JsonArray, JsonMap } from '@salesforce/ts-types';
import { ComponentSet } from '../collections';

abstract class ConvertTransactionFinalizer<T> {
  protected abstract _state: T;

  public setState(props: (state: T) => void): void {
    props(this._state);
  }

  get state(): T {
    return this._state;
  }

  public abstract finalize(): Promise<WriterFormat[]>;
}

export interface RecompositionState {
  [componentKey: string]: {
    /**
     * Parent component that children are rolled up into
     */
    component?: SourceComponent;
    /**
     * Children to be rolled up into the parent file
     */
    children?: ComponentSet;
  };
}

/**
 * Merges child components that share the same parent in the conversion pipeline
 * into a single file.
 */
class RecompositionFinalizer extends ConvertTransactionFinalizer<RecompositionState> {
  protected _state: RecompositionState = {};

  public async finalize(): Promise<WriterFormat[]> {
    const writerData: WriterFormat[] = [];

    for (const { component: parent, children } of Object.values(this.state)) {
      const recomposedXmlObj = await this.recompose(children, parent);
      writerData.push({
        component: parent,
        writeInfos: [
          {
            source: new JsToXml(recomposedXmlObj),
            output: join(parent.type.directoryName, `${parent.fullName}.${parent.type.suffix}`),
          },
        ],
      });
    }

    return writerData;
  }

  private async recompose(children: ComponentSet, parent: SourceComponent): Promise<JsonMap> {
    const parentXmlObj: JsonMap = await parent.parseXml();

    for (const child of children) {
      const { directoryName: groupName } = child.type;
      const { name: parentName } = child.parent.type;
      const xmlObj = await (child as SourceComponent).parseXml();
      const childContents = xmlObj[child.type.name];

      if (!parentXmlObj[parentName]) {
        parentXmlObj[parentName] = { [XML_NS_KEY]: XML_NS_URL };
      }

      const parent = parentXmlObj[parentName] as JsonMap;

      if (!parent[groupName]) {
        parent[groupName] = [];
      }

      const group = parent[groupName] as JsonArray;

      group.push(childContents);
    }

    return parentXmlObj;
  }
}

export interface DecompositionState {
  [componentKey: string]: {
    foundMerge?: boolean;
    writeInfo?: WriteInfo;
    origin?: MetadataComponent;
  };
}

/**
 * Creates write infos for any children that haven't been written yet. Children may
 * delay being written in order to find potential existing children to merge
 * with in the conversion pipeline.
 */
class DecompositionFinalizer extends ConvertTransactionFinalizer<DecompositionState> {
  protected _state: DecompositionState = {};

  public async finalize(): Promise<WriterFormat[]> {
    const writerData: WriterFormat[] = [];

    for (const toDecompose of Object.values(this._state)) {
      if (!toDecompose.foundMerge) {
        writerData.push({
          component: toDecompose.origin.parent ?? toDecompose.origin,
          writeInfos: [toDecompose.writeInfo],
        });
      }
    }

    return writerData;
  }
}

/**
 * A state manager over the course of a single metadata conversion call.
 */
export class ConvertContext {
  public readonly decomposition = new DecompositionFinalizer();
  public readonly recomposition = new RecompositionFinalizer();

  public async *executeFinalizers(): AsyncIterable<WriterFormat[]> {
    for (const member of Object.values(this)) {
      if (member instanceof ConvertTransactionFinalizer) {
        yield member.finalize();
      }
    }
  }
}
