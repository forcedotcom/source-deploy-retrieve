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
import { MetadataComponent, XML_NS_URL } from '../common';
import { JsonArray, JsonMap } from '@salesforce/ts-types';

abstract class ConvertTransactionFinalizer<T> {
  protected abstract _state: T;

  public setState(props: Partial<T> | ((state: T) => void)): void {
    if (typeof props === 'function') {
      props(this._state);
    }
    this._state = Object.assign(this._state, props);
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
    children?: SourceComponent[];
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
      const baseObject: JsonMap = parent.xml ? await parent.parseXml() : {};
      const recomposedXmlObj = await this.recompose(children, baseObject);
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

  private async recompose(children: SourceComponent[], baseXmlObj: any): Promise<JsonMap> {
    for (const child of children) {
      const { directoryName: groupNode } = child.type;
      const { name: parentName } = child.parent.type;
      const childContents = (await child.parseXml())[child.type.name];
      if (!baseXmlObj[parentName]) {
        baseXmlObj[parentName] = { '@_xmlns': XML_NS_URL };
      }

      if (!baseXmlObj[parentName][groupNode]) {
        baseXmlObj[parentName][groupNode] = [];
      }
      (baseXmlObj[parentName][groupNode] as JsonArray).push(childContents);
    }
    return baseXmlObj;
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

  public async *executeFinalizers(): AsyncIterable<WriterFormat | WriterFormat[]> {
    for (const member of Object.values(this)) {
      if (member instanceof ConvertTransactionFinalizer) {
        yield member.finalize();
      }
    }
  }
}
